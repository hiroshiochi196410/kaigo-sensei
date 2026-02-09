import crypto from "crypto";

// Minimal signed cookie helper (no external deps)

function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(str) {
  const padLen = (4 - (str.length % 4)) % 4;
  const padded = str + "=".repeat(padLen);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function parseCookies(req) {
  const header = req?.headers?.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function serializeCookie(name, value, opts = {}) {
  const encVal = encodeURIComponent(value);
  let s = `${name}=${encVal}`;

  if (opts.maxAgeSeconds !== undefined && opts.maxAgeSeconds !== null) {
    s += `; Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`;
  }
  if (opts.expires instanceof Date) {
    s += `; Expires=${opts.expires.toUTCString()}`;
  }

  s += `; Path=${opts.path || "/"}`;

  if (opts.httpOnly) s += "; HttpOnly";
  if (opts.secure) s += "; Secure";
  if (opts.sameSite) s += `; SameSite=${opts.sameSite}`;

  return s;
}

export function signPayload(payload, secret) {
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body, "utf8").digest();
  return `${body}.${base64urlEncode(sig)}`;
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigStr] = parts;
  if (!body || !sigStr) return null;

  try {
    const sig = base64urlDecode(sigStr);
    const expected = crypto.createHmac("sha256", secret).update(body, "utf8").digest();
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(sig, expected)) return null;

    const payloadJson = base64urlDecode(body).toString("utf8");
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

export function setCookieHeader(res, cookieStr) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", cookieStr);
  } else if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [prev, cookieStr]);
  }
}

export function getSignedCookie(cookies, name, secret) {
  const token = cookies?.[name] || null;
  if (!token) return null;
  return verifyToken(token, secret);
}

export function setSignedCookie(res, name, payload, secret, opts = {}) {
  const token = signPayload(payload, secret);
  const cookieStr = serializeCookie(name, token, opts);
  setCookieHeader(res, cookieStr);
  return token;
}

export function clearCookie(res, name, opts = {}) {
  const cookieStr = serializeCookie(name, "", { ...opts, maxAgeSeconds: 0 });
  setCookieHeader(res, cookieStr);
}
