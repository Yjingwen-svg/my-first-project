import { state } from "../core/state.js";
import { createShape } from "../models/elementFactory.js";
import { scheduleRender } from "../core/renderer.js";

// 性能压测入口：
// 1) 批量生成 100 个元素
// 2) 统计首次可见渲染耗时
// 3) 输出一段简易 FPS 采样结果
export function installPerfHelpers() {
  window.canvasPerfTest = async () => {
    const start = performance.now();
    const list = [];
    const { canvas, view } = state;
    const screenW = canvas?.width || 1200;
    const screenH = canvas?.height || 800;
    const centerWorldX = (screenW / 2 - view.x) / view.scale;
    const centerWorldY = (screenH / 2 - view.y) / view.scale;
    const cols = 20;
    const rows = 5;
    const gapX = 120;
    const gapY = 160;
    const startX = centerWorldX - ((cols - 1) * gapX) / 2;
    const startY = centerWorldY - ((rows - 1) * gapY) / 2;
    for (let i = 0; i < 100; i++) {
      const t = ["rect", "circle", "triangle"][i % 3];
      const x = startX + (i % cols) * gapX;
      const y = startY + Math.floor(i / cols) * gapY;
      const el = createShape(t, x, y, x + 80, y + 60);
      list.push(el);
    }
    state.elements.push(...list);
    scheduleRender();
    await new Promise((r) => requestAnimationFrame(r));
    const renderDone = performance.now();

    let frames = 0;
    const fpsStart = performance.now();
    await new Promise((resolve) => {
      function tick() {
        frames += 1;
        if (performance.now() - fpsStart >= 1000) return resolve();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const fps = frames;
    console.log(`[perf] 首次渲染耗时: ${(renderDone - start).toFixed(1)}ms, 1s 采样 FPS: ${fps}`);
    return { firstRenderMs: renderDone - start, fps };
  };
}
