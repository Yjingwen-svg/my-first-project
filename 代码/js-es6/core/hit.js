import { constants } from "./state.js";
import { getCenter } from "../models/elementFactory.js";
import { rotateLocal } from "./geometry.js";

function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const cross = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-6) + xi;
    if (cross) inside = !inside;
  }
  return inside;
}

export function hitElement(worldPoint, el) {
  const center = getCenter(el);
  const rad = -(el.rotation || 0);
  const local = rotateLocal({ x: worldPoint.x - center.x, y: worldPoint.y - center.y }, rad);
  const tol = constants.HIT_TOLERANCE;

  if (el.type === "rect" || el.type === "image" || el.type === "text") {
    return local.x >= -el.width / 2 - tol && local.x <= el.width / 2 + tol && local.y >= -el.height / 2 - tol && local.y <= el.height / 2 + tol;
  }
  if (el.type === "circle") {
    return Math.hypot(local.x, local.y) <= el.radius + tol;
  }

  const points = el.points.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
  return pointInPolygon(local.x, local.y, points);
}
