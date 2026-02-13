\
/**
 * shared/app-main.js
 * trainee/ssw 共通アプリ
 *
 * - JSONフォールバックで初期化停止を防ぐ
 * - 通常送信: 1 unit / 文書作成送信: 5 unit 固定
 * - 3段表示（JP / ローマ字 / ID）
 */
import { $, on, escapeHtml, fetchJsonWithFallback, sanitizeForTTS, todayKey } from "./core.js";
import { renderSubscriptionUI, wirePortalButton } from "./subscription.js";

const API = {
  chat: "/api/chat",
};

let config = null;
let examples = null;
let nextSendCost = 1;
let units = 0;

const DEFAULT_CONFIG = {
  appName: "kaigo-sensei",
  dailyUnits: 50,
  longFormScenes: ["急変", "転倒", "申し送り"],
  scenes: [
    { id: "kinkyu", labelJP: "急変", labelID: "Kondisi darurat" },
    { id: "tentou", labelJP: "転倒", labelID: "Jatuh" },
    { id: "moushiokuri", labelJP: "申し送り", labelID: "Serah terima" },
    { id: "nyuyoku", labelJP: "入浴", labelID: "Mandi" },
  ],
  roles: [
    { id: "senior", labelJP: "先輩", labelID: "Senior" },
    { id: "user", labelJP: "利用者", labelID: "Pengguna" },
    { id: "family", labelJP: "家族", labelID: "Keluarga" },
  ],
};

const DEFAULT_EXAMPLES = {
  kinkyu: [
    { jp: "息が苦しそうです。", romaji: "iki ga kurushisou desu.", id: "Napasnya terlihat sulit." },
  ],
  tentou: [
    { jp: "転びました。痛いですか？", romaji: "korobimashita. itai desu ka?", id: "Dia jatuh. Apakah sakit?" },
  ],
  moushiokuri: [
    { jp: "今日の状態を申し送ります。", romaji: "kyou no joutai wo moushiokurimasu.", id: "Saya serahkan laporan kondisi hari ini." },
  ],
};

function loadUnits() {
  const key = `units:${todayKey()}`;
  const raw = localStorage.getItem(key);
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return { key, value: n };
  return { key, value: config?.dailyUnits ?? DEFAULT_CONFIG.dailyUnits };
}

function saveUnits(key, value) {
  localStorage.setItem(key, String(Math.max(0, value)));
}

function renderUnits() {
  const el = $("unitsLabel");
  if (el) el.textContent = `今日の残り / Sisa hari ini: ${units}`;
}

function setSendCost(cost) {
  nextSendCost = cost;
  const b = $("btnSend");
  if (b) b.textContent = cost === 5 ? "送信(-5) / Kirim(-5)" : "送信(-1) / Kirim(-1)";
}

function getSelectedScene() {
  const sel = $("sceneSelect");
  return sel ? sel.value : "kinkyu";
}

function getSelectedRole() {
  const sel = $("roleSelect");
  return sel ? sel.value : "senior";
}

function appendBubble(who, tripleText) {
  const wrap = $("chat");
  if (!wrap) return;
  const { jp, romaji, id } = parseTriple(tripleText);
  const html = `
    <div class="bubble ${who}">
      <div class="line jp">${escapeHtml(jp)}</div>
      <div class="line romaji">${escapeHtml(romaji)}</div>
      <div class="line id">${escapeHtml(id)}</div>
    </div>
  `;
  wrap.insertAdjacentHTML("beforeend", html);
  wrap.scrollTop = wrap.scrollHeight;
}

function parseTriple(text) {
  const t = String(text ?? "").trim();
  if (!t) return { jp: "", romaji: "", id: "" };

  const parts = t.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return { jp: parts[0], romaji: parts[1], id: parts[2] };

  const m1 = t.match(/^(?:JP:|日本語:)\s*(.+)$/m);
  const m2 = t.match(/^(?:ROMAJI:|ローマ字:)\s*(.+)$/m);
  const m3 = t.match(/^(?:ID:|インドネシア語:)\s*(.+)$/m);
  if (m1 || m2 || m3) {
    return {
      jp: m1?.[1]?.trim() ?? "",
      romaji: m2?.[1]?.trim() ?? "",
      id: m3?.[1]?.trim() ?? "",
    };
  }
  return { jp: t, romaji: "", id: "" };
}

function renderSelectors() {
  const sceneSel = $("sceneSelect");
  const roleSel = $("roleSelect");

  if (sceneSel) {
    sceneSel.innerHTML = (config.scenes || []).map(s =>
      `<option value="${escapeHtml(s.id)}">${escapeHtml(s.labelJP)} / ${escapeHtml(s.labelID)}</option>`
    ).join("");
  }
  if (roleSel) {
    roleSel.innerHTML = (config.roles || []).map(r =>
      `<option value="${escapeHtml(r.id)}">${escapeHtml(r.labelJP)} / ${escapeHtml(r.labelID)}</option>`
    ).join("");
  }
}

function renderExamples() {
  const scene = getSelectedScene();
  const list = $("examples");
  if (!list) return;

  const arr = examples?.[scene] ?? [];
  if (!arr.length) {
    list.innerHTML = `<div class="muted">例文なし / Tidak ada contoh</div>`;
    return;
  }
  list.innerHTML = arr.slice(0, 6).map((x, i) => `
    <button class="ex" data-i="${i}">
      ${escapeHtml(x.jp)}<br>
      <span class="small">${escapeHtml(x.romaji)} / ${escapeHtml(x.id)}</span>
    </button>
  `).join("");

  list.querySelectorAll("button.ex").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.i);
      const item = arr[idx];
      const input = $("userInput");
      if (input && item?.jp) input.value = item.jp;
    });
  });
}

function isLongFormSceneById(sceneId) {
  const s = (config.scenes || []).find(x => x.id === sceneId);
  const labelJP = s?.labelJP ?? "";
  return (config.longFormScenes || []).includes(labelJP);
}

async function sendMessage() {
  const input = $("userInput");
  const text = (input?.value ?? "").trim();
  if (!text) return;

  const spend = nextSendCost;
  if (units < spend) {
    alert("unit が足りません / unit tidak cukup");
    return;
  }

  appendBubble("me", `JP: ${text}\n\nROMAJI:\n\nID:`);
  input.value = "";

  units -= spend;
  renderUnits();
  setSendCost(1);

  const scene = getSelectedScene();
  const role = getSelectedRole();

  const payload = {
    scene,
    role,
    input: text,
    longForm: isLongFormSceneById(scene),
    docMode: (spend === 5),
  };

  try {
    const r = await fetch(API.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const reply = j?.replyText || j?.text || "";
    appendBubble("ai", reply);

    const ttsText = sanitizeForTTS(parseTriple(reply).jp);
    const ttsEl = $("ttsText");
    if (ttsEl) ttsEl.textContent = ttsText;

  } catch (e) {
    console.warn("[chat] failed", e);
    appendBubble("ai", "日本語:\n通信に失敗しました。\n\nローマ字:\n\nインドネシア語:\nKoneksi gagal.");
  }
}

function wireUI() {
  on("sceneSelect", "change", () => {
    renderExamples();
    const longBtn = $("btnDoc");
    if (longBtn) longBtn.style.display = isLongFormSceneById(getSelectedScene()) ? "inline-flex" : "none";
  });

  on("roleSelect", "change", () => renderExamples());

  on("btnSend", "click", () => sendMessage());
  on("userInput", "keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendMessage();
  });

  on("btnDoc", "click", () => {
    setSendCost(5);
    $("userInput")?.focus();
  });

  wirePortalButton();
}

export async function boot(appMode) {
  config = await fetchJsonWithFallback(`./config.json`, DEFAULT_CONFIG);
  examples = await fetchJsonWithFallback(`./examples.json`, DEFAULT_EXAMPLES);

  const title = $("appTitle");
  if (title) title.textContent = `${config.appName || "kaigo-sensei"} (${appMode})`;

  renderSelectors();
  renderExamples();

  const u = loadUnits();
  units = u.value;
  renderUnits();
  window.addEventListener("beforeunload", () => saveUnits(u.key, units));

  setSendCost(1);

  renderSubscriptionUI();
  wireUI();

  const longBtn = $("btnDoc");
  if (longBtn) longBtn.style.display = isLongFormSceneById(getSelectedScene()) ? "inline-flex" : "none";
}
