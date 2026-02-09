import { parseCookies, getSignedCookie, setSignedCookie } from "./_lib/signedCookie.js";

const DEFAULT_LIMIT = Number(process.env.TRIAL_LIMIT_DEFAULT || 10);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const variant = (req.query?.variant === "ssw" || req.query?.variant === "trainee") ? req.query.variant : "trainee";

    const secret = process.env.TOKEN_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Missing TOKEN_SECRET", message: "Vercel環境変数 TOKEN_SECRET を設定してください" });
    }

    const cookies = parseCookies(req);

    let trial = getSignedCookie(cookies, "ks_trial", secret);
    if (!trial || typeof trial !== "object") {
      trial = { v: 1, i: Date.now(), u: {} };
    }
    if (!trial.u || typeof trial.u !== "object") trial.u = {};

    const used = Math.max(0, Number(trial.u[variant] || 0));
    const limit = DEFAULT_LIMIT;
    const remaining = Math.max(0, limit - used);

    // Refresh cookie so localStorageを消しても残り回数が復元される
    const secure = process.env.NODE_ENV === "production";
    setSignedCookie(res, "ks_trial", trial, secret, {
      httpOnly: true,
      sameSite: "Lax",
      secure,
      path: "/",
      maxAgeSeconds: 180 * 24 * 60 * 60, // 180 days
    });

    return res.status(200).json({ ok: true, variant, used, limit, remaining });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", message: e?.message || String(e) });
  }
}
