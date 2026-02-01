export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const subscriptionId = req.query?.subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: "Missing subscription_id" });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
    }

    // https://stripe.com/docs/api/subscriptions/retrieve
    const url = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await r.json();

    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data?.error?.message || "Stripe API error", raw: data });
    }

    const status = data.status || "unknown";

    // ここが「自動ロック」の判定基準
    // active / trialing のみを有効（必要なら past_due を許可する等に変更可）
    const active = status === "active" || status === "trialing";

    return res.status(200).json({
      active,
      status,
      cancel_at_period_end: !!data.cancel_at_period_end,
      canceled_at: data.canceled_at || null,
      ended_at: data.ended_at || null,
      current_period_end: data.current_period_end || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
