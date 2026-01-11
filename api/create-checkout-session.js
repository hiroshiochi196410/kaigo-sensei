export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { variant } = req.body || {};
    if (!variant || (variant !== "trainee" && variant !== "ssw")) {
      return res.status(400).json({ error: "Bad variant" });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });

    // URLはVercel env (SITE_URL) を優先。無ければアクセス元から推定。
    const siteUrl =
      process.env.SITE_URL ||
      (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}` : `https://${req.headers.host}`);

    const priceId =
      variant === "trainee"
        ? process.env.STRIPE_PRICE_ID_TRAINEE
        : process.env.STRIPE_PRICE_ID_SSW;

    if (!priceId) {
      return res.status(500).json({ error: `Missing STRIPE_PRICE_ID_${variant.toUpperCase()}` });
    }

    // Stripe API（SDK無し、fetchで直接）
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");

    // 完了後、同じ画面に戻して session_id を渡す（フロント側で verify-session を呼び出して解除）
    params.append("success_url", `${siteUrl}/app/${variant}/?success=1&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${siteUrl}/app/${variant}/?canceled=1`);

    // Hosted Checkout
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Stripe API error", raw: data });
    }

    return res.status(200).json({ url: data.url, id: data.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
