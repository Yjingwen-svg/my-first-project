import { constants, markDirty, state } from "./state.js";
import { createShape, getCenter, translateElement } from "../models/elementFactory.js";
import { getHandles, hitHandle, localBBox, rotateLocal, screenToWorld, worldBBox, worldToScreen } from "./geometry.js";
import { hitElement } from "./hit.js";
import { refreshPanel } from "../ui/panel.js";
import { schedulePersist } from "./store.js";
import { scheduleRender } from "./renderer.js";

function switchToSelectTool() {
  state.tool = "select";
  document.dispatchEvent(new CustomEvent("canvas:set-tool", { detail: { tool: "select" } }));
}

function selectedElements() {
  const set = new Set(state.selectedIds);
  return state.elements.filter((e) => set.has(e.id));
}

function findTopHit(world) {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    if (hitElement(world, state.elements[i])) return state.elements[i];
  }
  return null;
}

function getSnapLines(ignoreIds) {
  const ignore = new Set(ignoreIds);
  const xs = [];
  const ys = [];
  state.elements.forEach((el) => {
    if (ignore.has(el.id)) return;
    const box = worldBBox(el);
    const c = getCenter(el);
    xs.push(box.minX, box.maxX, c.x);
    ys.push(box.minY, box.maxY, c.y);
  });
  return { x: [...new Set(xs)], y: [...new Set(ys)] };
}

function snapDelta(selected, dx, dy) {
  // 吸附策略：比较“拖拽后”的边缘与中心点，取阈值内最近参考线。
  if (selected.length === 0) return { dx, dy, lines: { x: [], y: [] } };
  const ids = selected.map((e) => e.id);
  const lines = getSnapLines(ids);
  let bestX = { d: Infinity, offset: 0, line: null };
  let bestY = { d: Infinity, offset: 0, line: null };
  const targetsX = [];
  const targetsY = [];
  selected.forEach((el) => {
    const box = worldBBox(el);
    const c = getCenter(el);
    targetsX.push(box.minX + dx, box.maxX + dx, c.x + dx);
    targetsY.push(box.minY + dy, box.maxY + dy, c.y + dy);
  });
  targetsX.forEach((t) => {
    lines.x.forEach((line) => {
      const d = Math.abs(line - t);
      if (d < constants.SNAP_THRESHOLD && d < bestX.d) bestX = { d, offset: line - t, line };
    });
  });
  targetsY.forEach((t) => {
    lines.y.forEach((line) => {
      const d = Math.abs(line - t);
      if (d < constants.SNAP_THRESHOLD && d < bestY.d) bestY = { d, offset: line - t, line };
    });
  });
  return {
    dx: dx + bestX.offset,
    dy: dy + bestY.offset,
    lines: { x: bestX.line == null ? [] : [bestX.line], y: bestY.line == null ? [] : [bestY.line] },
  };
}

function resizeFromHandle(el, handle, world) {
  // 先把鼠标点转到元素局部坐标，再按手柄方向更新包围盒，避免旋转后缩放错位。
  const c = getCenter(el);
  const localMouse = rotateLocal({ x: world.x - c.x, y: world.y - c.y }, -(el.rotation || 0));
  const box = localBBox(el);
  let minX = box.minX;
  let maxX = box.maxX;
  let minY = box.minY;
  let maxY = box.maxY;
  if (handle === "tl") {
    minX = localMouse.x;
    minY = localMouse.y;
  } else if (handle === "tr") {
    maxX = localMouse.x;
    minY = localMouse.y;
  } else if (handle === "bl") {
    minX = localMouse.x;
    maxY = localMouse.y;
  } else if (handle === "br") {
    maxX = localMouse.x;
    maxY = localMouse.y;
  }
  const oldW = box.maxX - box.minX;
  const oldH = box.maxY - box.minY;
  const w = Math.max(5, maxX - minX);
  const h = Math.max(5, maxY - minY);
  if (el.type === "rect" || el.type === "image") {
    el.width = w;
    el.height = h;
    el.x = c.x - w / 2;
    el.y = c.y - h / 2;
  } else if (el.type === "text") {
    const sx = w / Math.max(1, oldW);
    const sy = h / Math.max(1, oldH);
    const scaleFactor = Math.min(sx, sy);
    el.width = w;
    el.height = h;
    el.x = c.x - w / 2;
    el.y = c.y - h / 2;
    // 文本手柄缩放时同步字号，避免“框变了字不变”。
    el.fontSize = Math.max(8, Math.min(240, Math.round((el.fontSize || 20) * scaleFactor)));
  } else if (el.type === "circle") {
    el.radius = Math.max(5, Math.min(w, h) / 2);
  } else {
    const old = el.points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    const oldBox = localBBox(el);
    const sx = w / Math.max(1, oldBox.maxX - oldBox.minX);
    const sy = h / Math.max(1, oldBox.maxY - oldBox.minY);
    el.points = old.map((p) => ({ x: c.x + p.x * sx, y: c.y + p.y * sy }));
  }
}

function startTextEditing(el) {
  const old = document.getElementById("floatingTextEditor");
  if (old) old.remove();
  const center = getCenter(el);
  const screen = worldToScreen(state.view, center.x, center.y);
  const div = document.createElement("div");
  div.id = "floatingTextEditor";
  div.contentEditable = "true";
  // 仅把真实文本放入编辑器，历史占位文案不进入可编辑内容。
  const existingText = (el.text || "").trim();
  div.innerText = existingText === "双击编辑文本" ? "" : existingText;
  div.style.position = "fixed";
  div.style.left = `${screen.x - (el.width * state.view.scale) / 2}px`;
  div.style.top = `${screen.y - (el.height * state.view.scale) / 2}px`;
  div.style.width = `${el.width * state.view.scale}px`;
  div.style.minHeight = `${el.height * state.view.scale}px`;
  div.style.background = "#ffffffdd";
  div.style.border = "1px solid #3b82f6";
  div.style.padding = "4px";
  div.style.zIndex = "999";
  div.style.whiteSpace = "pre-wrap";
  div.style.outline = "none";
  document.body.appendChild(div);
  div.focus();
  // 双击进入编辑后全选，用户直接输入即可替换，不会和旧内容拼接。
  const range = document.createRange();
  range.selectNodeContents(div);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const finish = () => {
    // 点击空白处失焦时保存，去掉首尾空白但保留换行结构。
    el.text = div.innerText.replace(/\u00A0/g, " ").trim();
    div.remove();
    schedulePersist();
    scheduleRender();
  };
  div.addEventListener("blur", finish, { once: true });
}

function addImageAt(world) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,.png,.jpg,.jpeg";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("图片最大 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const el = createShape("image", world.x, world.y, world.x, world.y);
        const ratio = Math.min(360 / img.width, 1);
        el.width = img.width * ratio;
        el.height = img.height * ratio;
        el.x = world.x - el.width / 2;
        el.y = world.y - el.height / 2;
        el.imageSrc = reader.result;
        el.imageObj = img;
        state.elements.push(el);
        state.selectedIds = [el.id];
        switchToSelectTool();
        refreshPanel();
        schedulePersist();
        scheduleRender();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export function installInteractions(canvas) {
  canvas.addEventListener("mousedown", (e) => {
    const world = screenToWorld(state.view, e.offsetX, e.offsetY);
    const interaction = state.interaction;
    state.showSnapLines = false;
    state.snapLines = { x: [], y: [] };

    if (state.tool === "hand" || e.code === "Space" || e.button === 1) {
      interaction.panning = { sx: e.offsetX, sy: e.offsetY };
      return;
    }
    if (state.tool === "select") {
      // 优先检测手柄；只有没点中手柄时才进入元素命中与框选逻辑。
      const selected = selectedElements();
      if (selected.length > 0) {
        const last = selected[selected.length - 1];
        const handle = hitHandle(state.view, last, e.offsetX, e.offsetY);
        if (handle === "rotate") {
          const c = getCenter(last);
          const s = worldToScreen(state.view, c.x, c.y);
          interaction.rotating = { id: last.id, base: last.rotation || 0, start: Math.atan2(e.offsetY - s.y, e.offsetX - s.x) };
          return;
        }
        if (handle) {
          interaction.resizing = { id: last.id, handle };
          return;
        }
      }
      const hit = findTopHit(world);
      if (hit) {
        if (e.ctrlKey) {
          if (state.selectedIds.includes(hit.id)) state.selectedIds = state.selectedIds.filter((id) => id !== hit.id);
          else state.selectedIds.push(hit.id);
        } else if (!state.selectedIds.includes(hit.id)) {
          state.selectedIds = [hit.id];
        }
        interaction.dragging = { sx: world.x, sy: world.y };
        refreshPanel();
        scheduleRender();
      } else {
        interaction.selectionBeforeBox = e.ctrlKey ? [...state.selectedIds] : [];
        if (!e.ctrlKey) state.selectedIds = [];
        state.boxSelection = { sx1: e.offsetX, sy1: e.offsetY, sx2: e.offsetX, sy2: e.offsetY };
        refreshPanel();
        scheduleRender();
      }
      return;
    }
    if (state.tool === "text") {
      const el = createShape("text", world.x, world.y, world.x, world.y);
      state.elements.push(el);
      state.selectedIds = [el.id];
      switchToSelectTool();
      refreshPanel();
      schedulePersist();
      scheduleRender();
      return;
    }
    if (state.tool === "image") {
      addImageAt(world);
      return;
    }
    interaction.drawing = { type: state.tool, x1: world.x, y1: world.y, x2: world.x, y2: world.y };
  });

  canvas.addEventListener("mousemove", (e) => {
    const world = screenToWorld(state.view, e.offsetX, e.offsetY);
    const interaction = state.interaction;
    if (interaction.panning) {
      const dx = e.offsetX - interaction.panning.sx;
      const dy = e.offsetY - interaction.panning.sy;
      interaction.panning = { sx: e.offsetX, sy: e.offsetY };
      state.view.x += dx;
      state.view.y += dy;
      scheduleRender();
      return;
    }
    if (interaction.rotating) {
      const el = state.elements.find((x) => x.id === interaction.rotating.id);
      if (!el) return;
      const c = getCenter(el);
      const s = worldToScreen(state.view, c.x, c.y);
      const ang = Math.atan2(e.offsetY - s.y, e.offsetX - s.x);
      el.rotation = interaction.rotating.base + (ang - interaction.rotating.start);
      scheduleRender();
      return;
    }
    if (interaction.resizing) {
      const el = state.elements.find((x) => x.id === interaction.resizing.id);
      if (!el) return;
      resizeFromHandle(el, interaction.resizing.handle, world);
      scheduleRender();
      return;
    }
    if (interaction.dragging) {
      const dx = world.x - interaction.dragging.sx;
      const dy = world.y - interaction.dragging.sy;
      interaction.dragging = { sx: world.x, sy: world.y };
      const selected = selectedElements();
      const snap = snapDelta(selected, dx, dy);
      selected.forEach((el) => translateElement(el, snap.dx, snap.dy));
      state.snapLines = snap.lines;
      state.showSnapLines = snap.lines.x.length > 0 || snap.lines.y.length > 0;
      scheduleRender();
      return;
    }
    if (state.boxSelection) {
      state.boxSelection.sx2 = e.offsetX;
      state.boxSelection.sy2 = e.offsetY;
      const left = Math.min(state.boxSelection.sx1, state.boxSelection.sx2);
      const top = Math.min(state.boxSelection.sy1, state.boxSelection.sy2);
      const right = Math.max(state.boxSelection.sx1, state.boxSelection.sx2);
      const bottom = Math.max(state.boxSelection.sy1, state.boxSelection.sy2);
      const p1 = screenToWorld(state.view, left, top);
      const p2 = screenToWorld(state.view, right, bottom);
      const ids = [...interaction.selectionBeforeBox];
      state.elements.forEach((el) => {
        const box = worldBBox(el);
        const inside = box.maxX >= p1.x && box.minX <= p2.x && box.maxY >= p1.y && box.minY <= p2.y;
        if (inside && !ids.includes(el.id)) ids.push(el.id);
      });
      state.selectedIds = ids;
      refreshPanel();
      scheduleRender();
      return;
    }
    if (interaction.drawing) {
      interaction.drawing.x2 = world.x;
      interaction.drawing.y2 = world.y;
      scheduleRender();
    }
  });

  function finishInteraction() {
    const interaction = state.interaction;
    if (interaction.drawing) {
      const d = interaction.drawing;
      const el = createShape(d.type, d.x1, d.y1, d.x2, d.y2);
      if (el) {
        const isTooSmall =
          (el.type === "rect" && (el.width < 5 || el.height < 5)) ||
          (el.type === "circle" && el.radius < 5) ||
          (el.type === "triangle" && worldBBox(el).maxX - worldBBox(el).minX < 5);
        if (!isTooSmall) {
          state.elements.push(el);
          state.selectedIds = [el.id];
          switchToSelectTool();
          refreshPanel();
        }
      }
    }
    const changed = interaction.dragging || interaction.drawing || interaction.resizing || interaction.rotating;
    state.interaction.drawing = null;
    state.interaction.panning = null;
    state.interaction.dragging = null;
    state.interaction.resizing = null;
    state.interaction.rotating = null;
    state.boxSelection = null;
    state.showSnapLines = false;
    state.snapLines = { x: [], y: [] };
    markDirty();
    scheduleRender();
    if (changed) schedulePersist();
  }

  canvas.addEventListener("mouseup", finishInteraction);
  canvas.addEventListener("mouseleave", finishInteraction);

  canvas.addEventListener("dblclick", (e) => {
    const world = screenToWorld(state.view, e.offsetX, e.offsetY);
    const hit = findTopHit(world);
    if (hit?.type === "text") startTextEditing(hit);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const ids = new Set(state.selectedIds);
      if (ids.size === 0) return;
      state.elements = state.elements.filter((el) => !ids.has(el.id));
      state.selectedIds = [];
      refreshPanel();
      schedulePersist();
      scheduleRender();
      e.preventDefault();
    }
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (e.ctrlKey) {
        const before = screenToWorld(state.view, sx, sy);
        const factor = 1 - e.deltaY * constants.ZOOM_SENSITIVITY;
        const ns = Math.min(constants.MAX_SCALE, Math.max(constants.MIN_SCALE, state.view.scale * factor));
        state.view.scale = ns;
        state.view.x = sx - before.x * ns;
        state.view.y = sy - before.y * ns;
      } else {
        state.view.x += -e.deltaX;
        state.view.y += -e.deltaY;
      }
      scheduleRender();
    },
    { passive: false }
  );
}
