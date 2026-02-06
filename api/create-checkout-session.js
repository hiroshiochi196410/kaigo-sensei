import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function planToVariant(planKey) {
  // trainee系は trainee アプリ、ssw系は ssw アプリへ戻す
  return (planKey === "trainee_lite" || planKey === "trainee_standard") ? "trainee" : "ssw";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { plan_key } = req.body || {}; // e.g. "trainee_lite" | "trainee_standard" | "ssw_standard" | "ssw_pro"
    if (!plan_key) return res.status(400).json({ error: "Missing plan_key" });

    const PRICE_MAP = {
      trainee_lite: process.env.STRIPE_PRICE_ID_TRAINEE_LITE,
      trainee_standard: process.env.STRIPE_PRICE_ID_TRAINEE_STANDARD,
      ssw_standard: process.env.STRIPE_PRICE_ID_SSW_STANDARD,
      ssw_pro: process.env.STRIPE_PRICE_ID_SSW_PRO,
      // backward compatibility
      ssw_professional: process.env.STRIPE_PRICE_ID_SSW_PRO,
    };

    const priceId = PRICE_MAP[plan_key];
    if (!priceId) return res.status(400).json({ error: "Invalid plan_key" });

    const variant = planToVariant(plan_key);

    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) return res.status(500).json({ error: "Missing SITE_URL" });

    const successUrl = `${siteUrl}/app/${variant}/?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/app/${variant}/?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
