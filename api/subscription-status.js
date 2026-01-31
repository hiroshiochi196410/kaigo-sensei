import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const subscriptionId = req.query?.subscription_id;
    if (!subscriptionId) return res.status(400).json({ error: "Missing subscription_id" });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });

    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    // 「解約＝即ロック」にしたい場合は active/trialing のみ許可
    const active = (sub.status === "active" || sub.status === "trialing");

    return res.status(200).json({
      active,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: sub.current_period_end,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
