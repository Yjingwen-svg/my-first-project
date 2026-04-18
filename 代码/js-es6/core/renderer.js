import { constants, markDirty, state } from "./state.js";
import { getCenter } from "../models/elementFactory.js";
import { getHandles, worldToScreen } from "./geometry.js";

function mod(n, m) {
  return ((n % m) + m) % m;
}

function drawGrid(ctx, canvas, view) {
  // 直接基于视图偏移绘制网格线，避免 pattern 平铺时出现拼缝和抖动。
  const baseWorldStep = 40;
  let screenStep = baseWorldStep * view.scale;
  while (screenStep < 20) screenStep *= 2;
  while (screenStep > 120) screenStep /= 2;
  const offsetX = mod(view.x, screenStep);
  const offsetY = mod(view.y, screenStep);

  ctx.save();
  ctx.strokeStyle = "#D1D8E0";
  ctx.lineWidth = 1;
  for (let x = offsetX; x <= canvas.width; x += screenStep) {
    const px = Math.round(x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }
  for (let y = offsetY; y <= canvas.height; y += screenStep) {
    const py = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
  }
  ctx.restore();
}

function drawElement(ctx, view, el) {
  ctx.save();
  const c = getCenter(el);
  ctx.translate(c.x, c.y);
  ctx.rotate(el.rotation || 0);
  if (el.type === "rect") {
    if (el.fillColor !== "transparent") {
      ctx.fillStyle = el.fillColor;
      ctx.fillRect(-el.width / 2, -el.height / 2, el.width, el.height);
    }
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = (el.strokeWidth || 2) / view.scale;
    ctx.strokeRect(-el.width / 2, -el.height / 2, el.width, el.height);
  } else if (el.type === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, el.radius, 0, Math.PI * 2);
    if (el.fillColor !== "transparent") {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = (el.strokeWidth || 2) / view.scale;
    ctx.stroke();
  } else if (el.type === "triangle") {
    const pts = el.points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.closePath();
    if (el.fillColor !== "transparent") {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = (el.strokeWidth || 2) / view.scale;
    ctx.stroke();
  } else if (el.type === "image") {
    const f = el.filters || { grayscale: 0, brightness: 100, contrast: 100 };
    ctx.filter = `grayscale(${f.grayscale}%) brightness(${f.brightness}%) contrast(${f.contrast}%)`;
    if (el.imageObj && el.imageObj.complete) {
      ctx.drawImage(el.imageObj, -el.width / 2, -el.height / 2, el.width, el.height);
    } else {
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(-el.width / 2, -el.height / 2, el.width, el.height);
      ctx.strokeStyle = "#9ca3af";
      ctx.strokeRect(-el.width / 2, -el.height / 2, el.width, el.height);
    }
    ctx.filter = "none";
  } else if (el.type === "text") {
    if (el.backgroundColor !== "transparent") {
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(-el.width / 2, -el.height / 2, el.width, el.height);
    }
    const italic = el.italic ? "italic " : "";
    const bold = el.bold ? "bold " : "";
    ctx.font = `${italic}${bold}${el.fontSize}px ${el.fontFamily}`;
    ctx.fillStyle = el.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const content = (el.text || "").trim();
    const lines = (content.length ? content : "双击编辑文本").split("\n");
    const lineH = el.fontSize * 1.25;
    const startY = -((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      const y = startY + i * lineH;
      if (!content.length) ctx.globalAlpha = 0.5;
      ctx.fillText(line, 0, y);
      ctx.globalAlpha = 1;
      const w = ctx.measureText(line).width;
      if (el.underline) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, y + el.fontSize * 0.35);
        ctx.lineTo(w / 2, y + el.fontSize * 0.35);
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1 / view.scale;
        ctx.stroke();
      }
      if (el.strike) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, y);
        ctx.lineTo(w / 2, y);
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 1 / view.scale;
        ctx.stroke();
      }
    });
  }
  ctx.restore();
}

function drawSelectionUi(ctx, canvas, view) {
  const selected = state.elements.filter((e) => state.selectedIds.includes(e.id));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "#3b82f6";
  ctx.fillStyle = "#ffffff";
  if (selected.length > 0) {
    for (const el of selected) {
      const { extCorners, rotateHandle } = getHandles(view, el);
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(extCorners[0].x, extCorners[0].y);
      for (let i = 1; i < extCorners.length; i++) ctx.lineTo(extCorners[i].x, extCorners[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of extCorners) {
        ctx.fillRect(p.x - constants.HANDLE_SIZE / 2, p.y - constants.HANDLE_SIZE / 2, constants.HANDLE_SIZE, constants.HANDLE_SIZE);
        ctx.strokeRect(p.x - constants.HANDLE_SIZE / 2, p.y - constants.HANDLE_SIZE / 2, constants.HANDLE_SIZE, constants.HANDLE_SIZE);
      }
      ctx.beginPath();
      ctx.arc(rotateHandle.x, rotateHandle.y, constants.HANDLE_SIZE / 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (state.boxSelection) {
    const { sx1, sy1, sx2, sy2 } = state.boxSelection;
    const left = Math.min(sx1, sx2);
    const top = Math.min(sy1, sy2);
    const w = Math.abs(sx2 - sx1);
    const h = Math.abs(sy2 - sy1);
    ctx.strokeStyle = "#3b82f6";
    ctx.fillStyle = "rgba(59,130,246,0.1)";
    ctx.fillRect(left, top, w, h);
    ctx.strokeRect(left, top, w, h);
  }
  if (state.showSnapLines) {
    ctx.strokeStyle = "#ef4444";
    ctx.setLineDash([6, 6]);
    for (const x of state.snapLines.x) {
      const p = worldToScreen(view, x, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, canvas.height);
      ctx.stroke();
    }
    for (const y of state.snapLines.y) {
      const p = worldToScreen(view, 0, y);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(canvas.width, p.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawDrawingPreview(ctx, view) {
  const d = state.interaction.drawing;
  if (!d) return;
  const x1 = d.x1;
  const y1 = d.y1;
  const x2 = d.x2;
  const y2 = d.y2;
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2 / view.scale;
  if (d.type === "rect") {
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (d.type === "circle") {
    ctx.beginPath();
    ctx.arc(x1, y1, Math.hypot(x2 - x1, y2 - y1), 0, Math.PI * 2);
    ctx.stroke();
  } else if (d.type === "triangle") {
    const dx = x2 - x1;
    const dy = y2 - y1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.lineTo(x1 - dx, y1 + dy);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function renderNow() {
  const { canvas, ctx, view } = state;
  if (!canvas || !ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas, view);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  for (const el of state.elements) drawElement(ctx, view, el);
  ctx.restore();
  drawDrawingPreview(ctx, view);
  drawSelectionUi(ctx, canvas, view);
  state.dirty = false;
}

export function scheduleRender() {
  markDirty();
  if (state.rafPending) return;
  state.rafPending = true;
  requestAnimationFrame(() => {
    state.rafPending = false;
    if (state.dirty) renderNow();
  });
}
