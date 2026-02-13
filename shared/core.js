\
/**
 * shared/core.js
 * - 落ちないDOM操作
 * - JSON読み込みフォールバック（相対→絶対→内蔵デフォルト）
 * - TTS用の括弧除去（全角/半角）
 */

export function $(id) {
  return document.getElementById(id);
}

/** 
 * 安全なイベント付与
 * 存在しないIDでも例外で止まらない（console.warnのみ）
 */
export function on(id, event, handler, opts) {
  const el = $(id);
  if (!el) {
    console.warn(`[safe-on] element not found: #${id}`);
    return null;
  }
  el.addEventListener(event, handler, opts);
  return el;
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * JSON読み込み：相対パス→絶対パス→デフォルト
 */
export async function fetchJsonWithFallback(relPath, defaultValue) {
  // 1) relative
  try {
    const r1 = await fetch(relPath, { cache: "no-store" });
    if (r1.ok) return await r1.json();
    console.warn(`[json] relative not ok: ${relPath} (${r1.status})`);
  } catch (e) {
    console.warn(`[json] relative failed: ${relPath}`, e);
  }

  // 2) absolute
  const absoluteUrl = new URL(relPath, location.origin).toString();
  try {
    const r2 = await fetch(absoluteUrl, { cache: "no-store" });
    if (r2.ok) return await r2.json();
    console.warn(`[json] absolute not ok: ${absoluteUrl} (${r2.status})`);
  } catch (e) {
    console.warn(`[json] absolute failed: ${absoluteUrl}`, e);
  }

  // 3) default
  console.warn("[json] using defaultValue for:", relPath);
  return defaultValue;
}

/**
 * TTS: （ ）内を読み上げない
 * - 半角 () と 全角 （） の両方に対応
 * - 入れ子っぽいケースにもある程度対応（繰り返し除去）
 */
export function sanitizeForTTS(text) {
  let t = String(text ?? "");
  for (let i = 0; i < 5; i++) {
    const before = t;
    t = t
      .replace(/\([^)]*\)/g, "")    // ( ... )
      .replace(/（[^）]*）/g, "");   // （ ... ）
    if (t === before) break;
  }
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function formatDateYmd(tsSec) {
  if (!tsSec) return "";
  const d = new Date(tsSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
