// api/tts.js
export default async function handler(req, res) {
  try {
    const { text, speed } = (req.method === "POST") ? (req.body || {}) : (req.query || {});
    if (!text) return res.status(400).json({ error: "missing text" });

    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "missing GOOGLE_TTS_API_KEY" });

    // 速度（Googleは speakingRate: 0.25〜4.0）
    const rate = speed === "slow" ? 0.85 : speed === "fast" ? 1.15 : 1.0;

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    const payload = {
      input: { text: String(text).slice(0, 500) }, // 念のため上限
      voice: {
        languageCode: "ja-JP",
        // 好みで変更可（例：ja-JP-Neural2-B など）
        name: "ja-JP-Standard-A",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: rate,
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok || !data.audioContent) {
      return res.status(500).json({ error: "tts failed", detail: data });
    }

    const mp3 = Buffer.from(data.audioContent, "base64");
    res.setHeader("Content-Type", "audio/mpeg");
    // 軽いキャッシュ（本格キャッシュはIndexedDB側でやる）
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(mp3);
  } catch (e) {
    return res.status(500).json({ error: "server error", message: e?.message || String(e) });
  }
}
