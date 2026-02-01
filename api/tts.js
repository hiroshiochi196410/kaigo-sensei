export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { text, lang, speed } = req.body || {};
    const t = String(text || "").trim();
    if (!t) return res.status(400).json({ success: false, error: "Missing text" });

    // Google Cloud Text-to-Speech API key
    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing GOOGLE_TTS_API_KEY (or GOOGLE_CLOUD_API_KEY)"
      });
    }

    // speed: "slow" | "normal" | "fast"
    const speakingRate =
      speed === "slow" ? 0.85 :
      speed === "fast" ? 1.15 : 1.0;

    const languageCode = (lang && typeof lang === "string") ? lang : "ja-JP";

    // Prefer Neural2 if available; falls back automatically if not.
    const voiceName =
      languageCode.startsWith("ja") ? "ja-JP-Neural2-B" :
      languageCode.startsWith("en") ? "en-US-Neural2-F" :
      "";

    const payload = {
      input: { text: t },
      voice: {
        languageCode,
        ...(voiceName ? { name: voiceName } : {}),
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate
      }
    };

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data?.error?.message || "Google TTS error",
        detail: data
      });
    }

    if (!data.audioContent) {
      return res.status(500).json({ success: false, error: "No audioContent from Google TTS" });
    }

    // Return base64 MP3
    return res.status(200).json({
      success: true,
      mime: "audio/mpeg",
      audioContent: data.audioContent
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Unknown error" });
  }
}
