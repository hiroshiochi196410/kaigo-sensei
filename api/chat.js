export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed", message: "POST only" });
    }

    const { prompt, meta } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const persona = meta?.persona || "user_calm";
    const scene = meta?.scene || "bath";
    const stage = Number(meta?.stage || 1);

    const PERSONAS = {
      user_calm: { label: "利用者：穏やか", ai_role: "resident", ai_tone_jp: "calm, cooperative, polite" },
      user_angry: { label: "利用者：怒り", ai_role: "resident", ai_tone_jp: "irritated, defensive, short answers" },
      dementia: { label: "利用者：少し混乱", ai_role: "resident", ai_tone_jp: "confused, needs reassurance, short sentences" },
      family_anxious: { label: "家族：不安", ai_role: "family", ai_tone_jp: "worried, asks safety questions" },
      family_complaint: { label: "家族：クレーム", ai_role: "family", ai_tone_jp: "complaining, expects apology and plan" }
    };

    const SCENES = {
      bath: { label: "入浴", jp: "privacy, consent, temperature, fall prevention" },
      meal: { label: "食事", jp: "posture, choking risk, pace, dignity" },
      toilet: { label: "排泄", jp: "privacy, timely assistance, hygiene" },
      night: { label: "夜間", jp: "anxiety, insomnia, wandering risk" },
      complaint: { label: "クレーム対応", jp: "apology, fact-finding, plan" }
    };

    const personaInfo = PERSONAS[persona] || PERSONAS.user_calm;
    const sceneInfo = SCENES[scene] || SCENES.bath;

    const safeJson = (text) => {
      try { return JSON.parse(text); } catch {}
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return {};
      try { return JSON.parse(m[0]); } catch { return {}; }
    };

    async function callOpenAI({ system, user, temperature = 0.3 }) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      });

      const j = await r.json();
      if (!r.ok) return { ok: false, body: j };

      const text = j.choices?.[0]?.message?.content || "";
      return { ok: true, json: safeJson(text) };
    }

    // ---------- STAGE 1 ----------
    if (stage === 1) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const system = `
You are Roleplay AI for a Japanese elderly care facility.
Persona: ${personaInfo.label}
Role: ${personaInfo.ai_role}
Tone: ${personaInfo.ai_tone_jp}
Scene: ${sceneInfo.label} (${sceneInfo.jp})

Return ONLY JSON:
{
 "ai_reply_jp": "",
 "feedback_jp": "",
 "suggested_reply_jp": ""
}
      `.trim();

      const result = await callOpenAI({ system, user: prompt, temperature: 0.4 });
      if (!result.ok) return res.status(502).json({ error: "OpenAI error", details: result.body });

      return res.status(200).json({ ...result.json, trace: { persona, scene } });
    }

    // ---------- STAGE 2 ----------
    if (stage === 2) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const system = `
Convert Japanese caregiver text into Romaji and Indonesian.
Return ONLY JSON:
{
 "romaji": "",
 "indonesian": ""
}
      `.trim();

      const result = await callOpenAI({ system, user: prompt, temperature: 0.2 });
      if (!result.ok) return res.status(502).json({ error: "OpenAI error", details: result.body });

      return res.status(200).json({ ...result.json, trace: { persona, scene } });
    }

    return res.status(400).json({ error: "Invalid stage" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e.message) });
  }
}
