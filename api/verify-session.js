export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const sessionId = req.query?.session_id;
    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });

    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=subscription.items.data.price`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Stripe API error", raw: data });
    }

    const paid = data.payment_status === "paid" || data.status === "complete";

    const sub = data.subscription || null;
    const subStatus = sub?.status || null;
    const active = subStatus === "active" || subStatus === "trialing";
    const priceId = sub?.items?.data?.[0]?.price?.id || null;

    let plan = null;
    if (priceId) {
      if (priceId === process.env.STRIPE_PRICE_ID_PRO) plan = "pro";
      if (priceId === process.env.STRIPE_PRICE_ID_LIGHT) plan = "light";
    }

    return res.status(200).json({
      paid,
      active,
      plan,
      status: data.status,
      payment_status: data.payment_status,
      subscription_id: sub?.id || null,
      subscription_status: subStatus,
      cancel_at_period_end: sub?.cancel_at_period_end ?? null,
      current_period_end: sub?.current_period_end ?? null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
