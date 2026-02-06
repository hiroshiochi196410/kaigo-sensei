function mapPriceToPlan(priceId, priceMeta) {
  // Prefer Stripe Price metadata if present
  const metaPlan = priceMeta?.plan_key || null;
  const metaLimit = priceMeta?.daily_limit || null;

  const PLAN_BY_ID = {
    [process.env.STRIPE_PRICE_ID_TRAINEE_LITE]: { plan_key: "trainee_lite", daily_limit: 30 },
    [process.env.STRIPE_PRICE_ID_TRAINEE_STANDARD]: { plan_key: "trainee_standard", daily_limit: 70 },
    [process.env.STRIPE_PRICE_ID_SSW_STANDARD]: { plan_key: "ssw_standard", daily_limit: 100 },
    [process.env.STRIPE_PRICE_ID_SSW_PRO]: { plan_key: "ssw_pro", daily_limit: 150 },
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

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });

    const subscriptionId = req.query?.subscription_id || null;
    const sessionId = req.query?.session_id || null;
    if (!subscriptionId && !sessionId) return res.status(400).json({ error: "Missing subscription_id or session_id" });

    // 1) subscription_id 優先
    if (subscriptionId) {
      const url = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Stripe API error", raw: data });

      const subStatus = data?.status || null;
      const cancelAtPeriodEnd = data?.cancel_at_period_end ?? null;

      // active でも「解約予約（cancel_at_period_end=true）」ならロック寄せ
      const active = (subStatus === "active" || subStatus === "trialing") && !cancelAtPeriodEnd;

      const price = data?.items?.data?.[0]?.price || null;
      const priceId = price?.id || null;
      const { plan_key, daily_limit } = mapPriceToPlan(priceId, price?.metadata);

      return res.status(200).json({
        ok: true,
        source: "subscription",
        active,
        plan_key,
        daily_limit,
        subscription_id: data?.id || null,
        subscription_status: subStatus,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: data?.current_period_end ?? null,
        price_id: priceId,
      });
    }

    // 2) session_id から subscription を展開
    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=subscription.items.data.price`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Stripe API error", raw: data });

    const sub = data.subscription || null;
    const subStatus = sub?.status || null;
    const cancelAtPeriodEnd = sub?.cancel_at_period_end ?? null;
    const active = (subStatus === "active" || subStatus === "trialing") && !cancelAtPeriodEnd;

    const price = sub?.items?.data?.[0]?.price || null;
    const priceId = price?.id || null;
    const { plan_key, daily_limit } = mapPriceToPlan(priceId, price?.metadata);

    return res.status(200).json({
      ok: true,
      source: "session",
      active,
      plan_key,
      daily_limit,
      session_status: data.status,
      payment_status: data.payment_status,
      subscription_id: sub?.id || null,
      subscription_status: subStatus,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_end: sub?.current_period_end ?? null,
      price_id: priceId,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", message: e?.message || String(e) });
  }
}
