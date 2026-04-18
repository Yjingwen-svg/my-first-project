import { state } from "./core/state.js";
import { installInteractions } from "./core/interactions.js";
import { loadBoard, schedulePersist } from "./core/store.js";
import { refreshPanel } from "./ui/panel.js";
import { scheduleRender } from "./core/renderer.js";
import { installPerfHelpers } from "./dev/perf.js";
import { worldBBox } from "./core/geometry.js";

function resizeCanvas() {
  const container = document.getElementById("canvasContainer");
  state.canvas.width = container.clientWidth;
  state.canvas.height = container.clientHeight;
  if (!state.initialView) {
    state.initialView = { x: state.canvas.width / 2, y: state.canvas.height / 2, scale: 1 };
    state.view = { ...state.initialView };
  }
  scheduleRender();
}

function bindToolbar() {
  const shapeBtns = document.querySelectorAll(".shape");
  function setTool(tool) {
    state.tool = tool;
    shapeBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === tool));
  }
  shapeBtns.forEach((btn) => btn.addEventListener("click", () => setTool(btn.dataset.tool)));
  setTool("select");

  document.querySelector('[data-tool="reset"]')?.addEventListener("click", () => {
    if (state.elements.length > 0 && state.canvas) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      state.elements.forEach((el) => {
        const box = worldBBox(el);
        minX = Math.min(minX, box.minX);
        minY = Math.min(minY, box.minY);
        maxX = Math.max(maxX, box.maxX);
        maxY = Math.max(maxY, box.maxY);
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const scale = 1;
      state.view = {
        x: state.canvas.width / 2 - cx * scale,
        y: state.canvas.height / 2 - cy * scale,
        scale,
      };
    } else if (state.initialView) {
      state.view = { ...state.initialView };
    }
    scheduleRender();
  });

  document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });

  document.addEventListener("canvas:set-tool", (e) => {
    const tool = e.detail?.tool;
    if (tool) setTool(tool);
  });
}

function bindWelcome() {
  const welcome = document.getElementById("welcomeScreen");
  const dismiss = document.getElementById("dismissWelcomeBtn");
  if (!welcome || !dismiss) return;
  dismiss.addEventListener("click", () => {
    welcome.style.opacity = "0";
    setTimeout(() => (welcome.style.display = "none"), 260);
  });
}

function bindStats() {
  const shapeCount = document.getElementById("bottomShapeCount");
  const zoom = document.getElementById("bottomZoom");
  const offset = document.getElementById("bottomOffset");
  if (!shapeCount || !zoom || !offset) return;
  setInterval(() => {
    shapeCount.textContent = String(state.elements.length);
    zoom.textContent = `${Math.round(state.view.scale * 100)}%`;
    offset.textContent = `${Math.round(state.view.x)}, ${Math.round(state.view.y)}`;
  }, 300);
}

async function bootstrap() {
  state.canvas = document.getElementById("whiteboardCanvas");
  state.ctx = state.canvas.getContext("2d");
  bindToolbar();
  bindWelcome();
  bindStats();
  installInteractions(state.canvas);
  installPerfHelpers();
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  await loadBoard();
  refreshPanel();
  scheduleRender();
  // 首次进入也触发一次保存，用于创建默认文档结构。
  schedulePersist();
}

document.addEventListener("DOMContentLoaded", bootstrap);
