// api/stripe/webhook.js
import crypto from "crypto";

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  // Stripe-Signature: t=...,v1=...
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce((acc, kv) => {
    const [k, v] = kv.split("=");
    acc[k] = v; // ★ここ重要（=）
    return acc;
  }, {});

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const payload = `${t}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  // timingSafeEqual は同じ長さのBufferが必要
  const a = Buffer.from(v1, "hex");        // ★ここ重要（hex）
  const b = Buffer.from(expected, "hex");  // ★ここ重要（hex）
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  const ok = verifyStripeSignature(rawBody, sig, secret);
  if (!ok) return res.status(400).send("Invalid signature");

  const event = JSON.parse(rawBody);
  console.log("✅ Stripe Webhook received:", event.type);

  return res.status(200).json({ received: true, type: event.type });
}
