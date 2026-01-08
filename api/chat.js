// api/chat.js (Vercel Node.js Serverless Function)
// OpenAI Chat Completions 版（Claude→ChatGPT API 切替用）
// 返却形式は Claude 互換: { content: [{ type:"text", text:"..." }] }

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", message: "POSTのみ対応" });
  }

  try {
    const { prompt, messages } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const temperature = Number(process.env.OPENAI_TEMPERATURE || 0.3);

    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    // フロントが prompt しか送らない場合に対応
    const chatMessages = Array.isArray(messages) && messages.length
      ? messages
      : [{ role: "user", content: String(prompt || "") }];

    if (!chatMessages[0]?.content) {
      return res.status(400).json({ error: "Missing prompt/messages" });
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: chatMessages
      })
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "OpenAI API error",
        details: data
      });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";

    // Claude互換形式で返す（既存UI側のパースを壊さない）
    return res.status(200).json({
      content: [{ type: "text", text }],
      text
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
