function mapPriceToPlan(priceId, priceMeta) {
  const metaPlan = priceMeta?.plan_key || null;
  const metaLimit = priceMeta?.daily_limit || null;

  const PLAN_BY_ID = {
    [process.env.STRIPE_PRICE_ID_TRAINEE_LITE]: { plan_key: "trainee_lite", daily_limit: 17 },
    [process.env.STRIPE_PRICE_ID_TRAINEE_STANDARD]: { plan_key: "trainee_standard", daily_limit: 30 },
    [process.env.STRIPE_PRICE_ID_SSW_STANDARD]: { plan_key: "ssw_standard", daily_limit: 48 },
    [process.env.STRIPE_PRICE_ID_SSW_PRO]: { plan_key: "ssw_pro", daily_limit: 89 },
  };

  if (metaPlan) {
    return {
      plan_key: metaPlan,
      daily_limit: metaLimit ? parseInt(metaLimit, 10) : (PLAN_BY_ID[priceId]?.daily_limit ?? null),
    };
  }
  return PLAN_BY_ID[priceId] || { plan_key: null, daily_limit: null };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const sessionId = req.query?.session_id;
    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });

    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=subscription.items.data.price`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Stripe API error", raw: data });

    const paid = data.payment_status === "paid" || data.status === "complete";

    const sub = data.subscription || null;
    const subStatus = sub?.status || null;
    const active = subStatus === "active" || subStatus === "trialing";

    const price = sub?.items?.data?.[0]?.price || null;
    const priceId = price?.id || null;
    const { plan_key, daily_limit } = mapPriceToPlan(priceId, price?.metadata);

    return res.status(200).json({
      paid,
      active,
      plan_key,
      daily_limit,
      status: data.status,
      payment_status: data.payment_status,
      subscription_id: sub?.id || null,
      subscription_status: subStatus,
      cancel_at_period_end: sub?.cancel_at_period_end ?? null,
      current_period_end: sub?.current_period_end ?? null,
      price_id: priceId,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", message: e?.message || String(e) });
  }
}
