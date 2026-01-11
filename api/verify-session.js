export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const sessionId = req.query?.session_id;
    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });

    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`;

    const r = await fetch(url, {
      headers: { "Authorization": `Bearer ${secret}` },
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Stripe API error", raw: data });
    }

    // Stripe: payment_status が paid ならOK（subscriptionの場合も最初の支払いが完了）
    const paid = data.payment_status === "paid" || data.status === "complete";

    return res.status(200).json({
      paid,
      status: data.status,
      payment_status: data.payment_status,
      subscription_status: data.subscription?.status,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
