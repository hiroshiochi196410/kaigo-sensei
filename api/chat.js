export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed", message: "POST only" });
    }

    const { prompt, meta } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const persona = meta?.persona || "user_calm";
    const scene = meta?.scene || "bath";

    const system = [
      "You are Roleplay AI for a Japanese elderly care facility.",
      "The USER is a caregiver (foreign staff). The AI plays the other side (resident/family).",
      "Return ONLY valid JSON. No markdown. No extra text.",
      "JSON schema:",
      "{",
      '  "ai_reply_jp": "...",',
      '  "ai_reply_romaji": "...",',
      '  "ai_reply_id": "...",',
      '  "feedback_jp": "...",',
      '  "suggested_reply_jp": "...",',
      '  "suggested_reply_romaji": "...",',
      '  "suggested_reply_id": "..."',
      "}",
      "Rules:",
      "- ai_reply_* : what the resident/family says next (natural Japanese).",
      "- suggested_reply_* : a better caregiver reply (short, polite, safe).",
      "- romaji should be readable for Indonesian learners.",
      "- Indonesian translation should be natural and simple.",
      "- Keep it concise. 1-3 sentences each."
    ].join("\n");

    const context = `persona=${persona}\nscene=${scene}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: context + "\nCaregiver said (Japanese):\n" + prompt }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: "OpenAI API error", details: data });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";

    // Try parse JSON for convenience
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }

    return res.status(200).json({ text, json });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
