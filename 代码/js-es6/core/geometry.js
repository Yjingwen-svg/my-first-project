import { constants } from "./state.js";
import { getCenter } from "../models/elementFactory.js";

// 坐标换算：世界坐标 = (屏幕坐标 - 视口偏移) / 缩放
export function screenToWorld(view, sx, sy) {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}

// 坐标换算：屏幕坐标 = 世界坐标 * 缩放 + 视口偏移
export function worldToScreen(view, wx, wy) {
  return { x: wx * view.scale + view.x, y: wy * view.scale + view.y };
}

export function rotateLocal(local, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: local.x * c - local.y * s, y: local.x * s + local.y * c };
}

export function localBBox(el) {
  if (el.type === "rect" || el.type === "image" || el.type === "text") {
    return { minX: -el.width / 2, minY: -el.height / 2, maxX: el.width / 2, maxY: el.height / 2 };
  }
  if (el.type === "circle") {
    return { minX: -el.radius, minY: -el.radius, maxX: el.radius, maxY: el.radius };
  }
  const center = getCenter(el);
  const localPts = el.points.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
  const xs = localPts.map((p) => p.x);
  const ys = localPts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function worldBBox(el) {
  const center = getCenter(el);
  const box = localBBox(el);
  const rad = el.rotation || 0;
  const corners = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ].map((p) => {
    const r = rotateLocal(p, rad);
    return { x: center.x + r.x, y: center.y + r.y };
  });
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function getHandles(view, el) {
  // 选中框增加 margin，避免手柄紧贴元素边缘导致难点中。
  const center = getCenter(el);
  const box = localBBox(el);
  const margin = constants.BBOX_MARGIN;
  const ext = {
    minX: box.minX - margin,
    minY: box.minY - margin,
    maxX: box.maxX + margin,
    maxY: box.maxY + margin,
  };
  const rad = el.rotation || 0;
  const corners = [
    { key: "tl", x: box.minX, y: box.minY },
    { key: "tr", x: box.maxX, y: box.minY },
    { key: "br", x: box.maxX, y: box.maxY },
    { key: "bl", x: box.minX, y: box.maxY },
  ].map((p) => {
    const w = rotateLocal({ x: p.x, y: p.y }, rad);
    const s = worldToScreen(view, center.x + w.x, center.y + w.y);
    return { ...p, screenX: s.x, screenY: s.y };
  });
  const extCorners = [
    { x: ext.minX, y: ext.minY },
    { x: ext.maxX, y: ext.minY },
    { x: ext.maxX, y: ext.maxY },
    { x: ext.minX, y: ext.maxY },
  ].map((p) => {
    const w = rotateLocal(p, rad);
    return worldToScreen(view, center.x + w.x, center.y + w.y);
  });
  const rotateLocalPt = { x: 0, y: ext.minY - constants.ROTATE_HANDLE_OFFSET };
  const rotateWorld = rotateLocal(rotateLocalPt, rad);
  const rotateHandle = worldToScreen(view, center.x + rotateWorld.x, center.y + rotateWorld.y);
  return { corners, extCorners, rotateHandle };
}

export function hitHandle(view, el, sx, sy) {
  const handles = getHandles(view, el);
  const half = constants.HANDLE_SIZE / 2;
  // 命中测试使用「外扩框角点」与实际绘制手柄完全一致，避免看得见但点不中。
  const handleKeys = ["tl", "tr", "br", "bl"];
  for (let i = 0; i < handles.extCorners.length; i++) {
    const p = handles.extCorners[i];
    if (Math.abs(sx - p.x) <= half && Math.abs(sy - p.y) <= half) return handleKeys[i];
  }
  if (Math.hypot(sx - handles.rotateHandle.x, sy - handles.rotateHandle.y) <= constants.HANDLE_SIZE + 2) {
    return "rotate";
  }
  return null;
}
