// 全局状态模块：统一管理画布数据、交互状态和渲染脏标记。
// 这样可以避免单文件里变量散落导致的作用域错误。
export const state = {
  canvas: null,
  ctx: null,
  elements: [],
  selectedIds: [],
  tool: "select",
  view: { x: 0, y: 0, scale: 1 },
  initialView: null,
  snapLines: { x: [], y: [] },
  showSnapLines: false,
  boxSelection: null,
  dirty: true,
  rafPending: false,
  interaction: {
    drawing: null,
    panning: null,
    dragging: null,
    resizing: null,
    rotating: null,
    selectionBeforeBox: [],
  },
};

export const constants = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 8,
  ZOOM_SENSITIVITY: 0.002,
  HANDLE_SIZE: 8,
  ROTATE_HANDLE_OFFSET: 24,
  HIT_TOLERANCE: 8,
  SNAP_THRESHOLD: 8,
  BBOX_MARGIN: 8,
};

export function markDirty() {
  state.dirty = true;
}

export function selectedElements() {
  if (state.selectedIds.length === 0) return [];
  const idSet = new Set(state.selectedIds);
  return state.elements.filter((el) => idSet.has(el.id));
}
