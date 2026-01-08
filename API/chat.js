export default async function handler(req, res) {
  try {
    // Allow only POST
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ error: "Method not allowed", message: "POSTのみ対応" });
    }

    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    // Chat Completions API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Return content exactly as requested.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "OpenAI API error", details: data });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";

    // Front is compatible with both:
    // - { content: [{ text: "..." }] } (Anthropic-like)
    // - { text: "..." }
    return res.status(200).json({ content: [{ text }], text });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(e?.message || e) });
  }
}
