\
/**
 * shared/subscription.js
 * 解約/プラン管理ボタンを「常時表示」し、状態表示を分岐する。
 */
import { $, on, formatDateYmd } from "./core.js";

const API = {
  status: "/api/subscription-status",
  portal: "/api/customer-portal",
};

export function renderSubscriptionUI() {
  const btn = $("btnPortal");
  if (btn) btn.style.display = "inline-flex";
  refreshSubscriptionStatus().catch(() => {});
}

async function refreshSubscriptionStatus() {
  const label = $("subStatusLabel");
  if (label) label.textContent = "checking…";

  let data = null;
  try {
    const r = await fetch(API.status, { cache: "no-store" });
    if (r.ok) data = await r.json();
  } catch (e) {
    console.warn("[subscription] status fetch failed", e);
  }

  const active = !!(data?.active || data?.status === "active");
  const cancelAtPeriodEnd = !!data?.cancel_at_period_end;
  const endDate = formatDateYmd(data?.current_period_end);

  if (!label) return;
  if (!data) {
    label.textContent = "status: unknown";
    return;
  }

  if (active && cancelAtPeriodEnd) {
    label.textContent = `解約予約中 / Batal terjadwal : ${endDate || "-"}`;
  } else if (active) {
    label.textContent = "契約中 / Aktif";
  } else {
    label.textContent = "未契約 / Tidak aktif";
  }

  if (data?.portal_url) window.__PORTAL_URL__ = data.portal_url;
}

export function wirePortalButton() {
  on("btnPortal", "click", async () => {
    const direct = window.__PORTAL_URL__;
    if (direct) {
      window.open(direct, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const r = await fetch(API.portal, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_url: location.href }),
      });
      const j = await r.json();
      const url = j?.url || j?.portal_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else alert("Customer Portal URL を取得できませんでした。");
    } catch (e) {
      console.warn("[subscription] portal open failed", e);
      alert("Customer Portal を開けませんでした。");
    }
  });
}
