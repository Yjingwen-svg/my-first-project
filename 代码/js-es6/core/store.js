import { state } from "./state.js";
import { scheduleRender } from "./renderer.js";
import { nextId, syncIdSeed } from "../models/elementFactory.js";

const DB_NAME = "InfiniteCanvasDB";
const STORE_NAME = "documents";
const DOC_KEY = "default-board";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function serializeElement(el) {
  const copy = { ...el };
  delete copy.imageObj;
  return copy;
}

function hydrateElement(el) {
  if (el.type !== "image" || !el.imageSrc) return el;
  const img = new Image();
  img.src = el.imageSrc;
  el.imageObj = img;
  return el;
}

export async function saveBoard() {
  // 保存可序列化快照：元素 + 视口；图片对象本身不可序列化，改存 imageSrc。
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(
    {
      elements: state.elements.map(serializeElement),
      view: state.view,
      updatedAt: Date.now(),
    },
    DOC_KEY
  );
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadBoard() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).get(DOC_KEY);
  const data = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!data) return false;
  state.elements = (data.elements || []).map(hydrateElement);
  // 对历史数据做一次去重修复，防止重复 ID 引发“错误选中框”。
  const seen = new Set();
  state.elements.forEach((el) => {
    if (!el.id || seen.has(el.id)) el.id = nextId();
    seen.add(el.id);
  });
  syncIdSeed(state.elements);
  if (data.view) state.view = data.view;
  scheduleRender();
  return true;
}

let saveTimer = null;
export function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveBoard().catch(() => {});
  }, 250);
}
