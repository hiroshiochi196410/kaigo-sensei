export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, rate } = req.body || {};
    const inputText = (text || "").toString().trim();
    if (!inputText) return res.status(400).json({ error: "Missing text" });

    // Google Cloud Text-to-Speech API Key
    const apiKey =
      process.env.GOOGLE_TTS_API_KEY ||
      process.env.GOOGLE_CLOUD_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GOOGLE_TTS_API_KEY",
        hint: "VercelのEnvironment Variablesに GOOGLE_TTS_API_KEY を追加してください"
      });
    }

    // 速度（0.25〜4.0 推奨レンジ）
    const speakingRate = Math.max(0.25, Math.min(4.0, Number(rate) || 1.0));

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      input: { text: inputText },
      voice: {
        languageCode: "ja-JP",
        name: "ja-JP-Neural2-B" // 男性寄り。必要ならA/C/Dなどに変更OK
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate
      }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(502).json({
        error: "Google TTS failed",
        status: r.status,
        detail: errText.slice(0, 500)
      });
    }

    const data = await r.json();
    const audioContent = data && data.audioContent;
    if (!audioContent) {
      return res.status(502).json({ error: "No audioContent" });
    }

    const buf = Buffer.from(audioContent, "base64");
    res.setHeader("Content-Type", "audio/mpeg");
    // キャッシュ：同じ文は何度も使うので短めに許可
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e?.message || String(e) });
  }
}
