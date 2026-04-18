import { state } from "../core/state.js";
import { schedulePersist } from "../core/store.js";
import { scheduleRender } from "../core/renderer.js";

const panel = document.getElementById("propertyPanel");
const panelContent = document.getElementById("panelContent");

function inputRow(label, inputHtml) {
  return `<div class="property-group"><label>${label}</label>${inputHtml}</div>`;
}

function oneSelected() {
  if (state.selectedIds.length !== 1) return null;
  return state.elements.find((e) => e.id === state.selectedIds[0]) || null;
}

function bindCommonShape(el) {
  const fill = document.getElementById("propFill");
  const strokeW = document.getElementById("propStrokeW");
  const stroke = document.getElementById("propStroke");
  fill.addEventListener("input", () => {
    el.fillColor = fill.value;
    scheduleRender();
    schedulePersist();
  });
  strokeW.addEventListener("input", () => {
    el.strokeWidth = Number(strokeW.value);
    scheduleRender();
    schedulePersist();
  });
  stroke.addEventListener("input", () => {
    el.strokeColor = stroke.value;
    scheduleRender();
    schedulePersist();
  });
}

function bindImage(el) {
  ["gray", "bright", "contrast"].forEach((k) => {
    const n = document.getElementById(`img_${k}`);
    n.addEventListener("input", () => {
      el.filters = {
        grayscale: Number(document.getElementById("img_gray").value),
        brightness: Number(document.getElementById("img_bright").value),
        contrast: Number(document.getElementById("img_contrast").value),
      };
      scheduleRender();
      schedulePersist();
    });
  });
}

function bindText(el) {
  const keys = [
    ["fontFamily", "tx_family"],
    ["fontSize", "tx_size"],
    ["color", "tx_color"],
    ["backgroundColor", "tx_bg"],
  ];
  keys.forEach(([prop, id]) => {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
      el[prop] = prop === "fontSize" ? Number(input.value) : input.value;
      scheduleRender();
      schedulePersist();
    });
  });
  ["bold", "italic", "underline", "strike"].forEach((k) => {
    const btn = document.getElementById(`tx_${k}`);
    btn.addEventListener("click", () => {
      el[k] = !el[k];
      btn.classList.toggle("active", !!el[k]);
      scheduleRender();
      schedulePersist();
    });
  });
}

export function refreshPanel() {
  const el = oneSelected();
  if (!el) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";
  if (el.type === "rect" || el.type === "circle" || el.type === "triangle") {
    panelContent.innerHTML =
      inputRow("背景色", `<input id="propFill" type="color" value="${el.fillColor === "transparent" ? "#ffffff" : el.fillColor}">`) +
      inputRow("边框宽度", `<input id="propStrokeW" type="range" min="1" max="12" value="${el.strokeWidth || 2}">`) +
      inputRow("边框颜色", `<input id="propStroke" type="color" value="${el.strokeColor || "#BC8E87"}">`);
    bindCommonShape(el);
  } else if (el.type === "image") {
    panelContent.innerHTML =
      inputRow("灰度", `<input id="img_gray" class="filter-slider" type="range" min="0" max="100" value="${el.filters?.grayscale ?? 0}">`) +
      inputRow("亮度", `<input id="img_bright" class="filter-slider" type="range" min="20" max="200" value="${el.filters?.brightness ?? 100}">`) +
      inputRow("对比度", `<input id="img_contrast" class="filter-slider" type="range" min="20" max="200" value="${el.filters?.contrast ?? 100}">`);
    bindImage(el);
  } else if (el.type === "text") {
    panelContent.innerHTML =
      inputRow("字体", `<input id="tx_family" value="${el.fontFamily || "Arial"}">`) +
      inputRow("字号", `<input id="tx_size" type="number" min="8" max="120" value="${el.fontSize || 20}">`) +
      inputRow("颜色", `<input id="tx_color" type="color" value="${el.color || "#111111"}">`) +
      inputRow("背景色", `<input id="tx_bg" type="color" value="${el.backgroundColor === "transparent" ? "#ffffff" : el.backgroundColor}">`) +
      `<div class="property-group"><label>样式</label><div class="style-buttons">
      <button id="tx_bold" class="style-btn ${el.bold ? "active" : ""}">B</button>
      <button id="tx_italic" class="style-btn ${el.italic ? "active" : ""}">I</button>
      <button id="tx_underline" class="style-btn ${el.underline ? "active" : ""}">U</button>
      <button id="tx_strike" class="style-btn ${el.strike ? "active" : ""}">S</button>
      </div></div>`;
    bindText(el);
  }
}
