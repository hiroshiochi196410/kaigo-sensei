import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { plan } = req.body || {}; // "light" or "pro"

    // ★ここが切り替え本体（サーバー側で決めるのが安全）
    const PRICE_MAP = {
      light: process.env.STRIPE_PRICE_ID_LIGHT,
      pro: process.env.STRIPE_PRICE_ID_PRO,
    };

    const priceId = PRICE_MAP[plan];
    if (!priceId) return res.status(400).json({ error: "Invalid plan" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/?canceled=1`,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
