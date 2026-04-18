// 元素工厂：负责创建不同类型元素，统一默认样式和可序列化字段。
let idSeed = 1;
export function nextId() {
  return `el_${idSeed++}`;
}

export function syncIdSeed(elements) {
  // 从已加载元素中恢复下一个可用 ID，避免重复 ID 导致“未选中却出现选中框”。
  const maxId = elements.reduce((max, el) => {
    const m = typeof el.id === "string" ? Number(el.id.replace("el_", "")) : 0;
    return Number.isFinite(m) ? Math.max(max, m) : max;
  }, 0);
  idSeed = maxId + 1;
}

function base(type) {
  return {
    id: nextId(),
    type,
    rotation: 0,
    strokeColor: "#BC8E87",
    strokeWidth: 2,
    fillColor: "transparent",
  };
}

export function createShape(type, x1, y1, x2, y2) {
  if (type === "rect") {
    return {
      ...base("rect"),
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }
  if (type === "circle") {
    return {
      ...base("circle"),
      strokeColor: "#98A9BD",
      cx: x1,
      cy: y1,
      radius: Math.hypot(x2 - x1, y2 - y1),
    };
  }
  if (type === "triangle") {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return {
      ...base("triangle"),
      strokeColor: "#A9BA9D",
      points: [
        { x: x1, y: y1 },
        { x: x1 + dx, y: y1 + dy },
        { x: x1 - dx, y: y1 + dy },
      ],
    };
  }
  if (type === "text") {
    return {
      ...base("text"),
      x: x1 - 80,
      y: y1 - 24,
      width: 160,
      height: 48,
      // 文本默认从空内容开始，避免双击编辑时旧占位文案残留。
      text: "",
      fontFamily: "Arial",
      fontSize: 20,
      color: "#111111",
      backgroundColor: "transparent",
      bold: false,
      italic: false,
      underline: false,
      strike: false,
    };
  }
  if (type === "image") {
    return {
      ...base("image"),
      x: x1 - 100,
      y: y1 - 60,
      width: 200,
      height: 120,
      imageSrc: "",
      imageObj: null,
      filters: { grayscale: 0, brightness: 100, contrast: 100 },
    };
  }
  return null;
}

export function getCenter(el) {
  if (el.type === "rect" || el.type === "image" || el.type === "text") {
    return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  }
  if (el.type === "circle") return { x: el.cx, y: el.cy };
  const sum = el.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / el.points.length, y: sum.y / el.points.length };
}

export function translateElement(el, dx, dy) {
  if (el.type === "rect" || el.type === "image" || el.type === "text") {
    el.x += dx;
    el.y += dy;
    return;
  }
  if (el.type === "circle") {
    el.cx += dx;
    el.cy += dy;
    return;
  }
  el.points.forEach((p) => {
    p.x += dx;
    p.y += dy;
  });
}
