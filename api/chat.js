export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed", message: "POST only" });
    }

    const { prompt, meta } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const persona = meta?.persona || "user_calm";
    const scene = meta?.scene || "bath";
    const category = meta?.category || "voice";
    const level = meta?.level || "beginner";
    const stage = Number(meta?.stage || 3);
    const userLang = meta?.user_lang || "auto";
    const variant = meta?.variant || "trainee";
    const ctx = Array.isArray(meta?.ctx) ? meta.ctx.slice(-6) : [];

    const PERSONAS = {
      user_calm: { label: "利用者：穏やか", ai_role: "resident", ai_tone: "calm, cooperative, polite" },
      user_angry: { label: "利用者：怒り", ai_role: "resident", ai_tone: "irritated, defensive, short answers" },
      dementia: { label: "利用者：少し混乱", ai_role: "resident", ai_tone: "confused, needs reassurance, short sentences" },
      family_anxious: { label: "家族：不安", ai_role: "family", ai_tone: "worried, asks safety questions" },
      family_complaint: { label: "家族：クレーム", ai_role: "family", ai_tone: "complaining, expects apology and plan" }
    };

    const SCENES = {
      bath: { label: "入浴", focus: "privacy, consent, temperature, fall prevention" },
      meal: { label: "食事", focus: "posture, choking risk, pace, dignity" },
      toilet: { label: "排泄", focus: "privacy, timely assistance, hygiene" },
      night: { label: "夜間", focus: "anxiety, insomnia, wandering risk" },
      complaint: { label: "クレーム対応", focus: "apology, fact-finding, plan" }
    };

    const CATEGORIES = {
      // bath
      voice: "声かけ（安心・説明）",
      temperature: "温度確認",
      privacy: "羞恥・プライバシー",
      refusal: "拒否対応",
      safety: "安全配慮",
      // meal
      start: "開始/準備",
      swallow: "嚥下/むせ",
      pace: "ペース調整",
      // toilet
      urge: "誘導/声かけ",
      transfer: "移乗/立位",
      accident: "失敗/汚染",
      hygiene: "清潔/後始末",
      // night
      sleep: "眠れない",
      anxiety: "不安/混乱",
      pain: "痛み/体調",
      wander: "徘徊/起き上がり",
      // complaint
      apology: "謝罪/受容",
      fact: "事実確認",
      plan: "対応方針",
      escalate: "上席/連携",
      followup: "報告/再発防止"
    };

    const personaInfo = PERSONAS[persona] || PERSONAS.user_calm;
    const sceneInfo = SCENES[scene] || SCENES.bath;
    const categoryLabel = CATEGORIES[category] || category;

    const safeJson = (text) => {
      try { return JSON.parse(text); } catch {}
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return {};
      try { return JSON.parse(m[0]); } catch { return {}; }
    };

    async function callOpenAI({ system, user, temperature = 0.3, maxTokens = 900 }) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          // JSONモード（可能なモデルであればJSONのみを返しやすくする）
          response_format: { type: "json_object" },
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

    // ---------- STAGE 1 / 2 (互換) ----------
    // 既存クライアントが使っている場合のために残す
    if (stage === 1) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const system = `
You are Roleplay AI for a Japanese elderly care facility.
Persona: ${personaInfo.label}
Role: ${personaInfo.ai_role}
Tone: ${personaInfo.ai_tone}
Scene: ${sceneInfo.label} (${sceneInfo.focus})
Category: ${categoryLabel}
Level: ${level}

Return ONLY JSON:
{
 "ai_reply_jp": "",
 "feedback_jp": "",
 "suggested_reply_jp": ""
}
      `.trim();

      const result = await callOpenAI({ system, user: prompt, temperature: 0.4, maxTokens: 500 });
      if (!result.ok) return res.status(502).json({ error: "OpenAI error", details: result.body });

      return res.status(200).json({ ...result.json, trace: { persona, scene, category, level } });
    }

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

      const result = await callOpenAI({ system, user: prompt, temperature: 0.2, maxTokens: 300 });
      if (!result.ok) return res.status(502).json({ error: "OpenAI error", details: result.body });

      return res.status(200).json({ ...result.json, trace: { persona, scene, category, level } });
    }

    // ---------- STAGE 3 (推奨): 3段表示＋ロールプレイ＋提案 ----------
    if (stage === 3) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const system = `
You are "AIGA", a roleplay conversation partner for training Indonesian caregivers working in Japan.
Your job: make practice conversations for Japanese elderly care (kaigo).
The user's input may be Japanese or Indonesian.

Roleplay setup:
- Scene: ${sceneInfo.label}
- Focus: ${sceneInfo.focus}
- Category: ${categoryLabel}
- Persona: ${personaInfo.label}
- Role you play: ${personaInfo.ai_role}
- Tone: ${personaInfo.ai_tone}
- Difficulty level: ${level} (beginner / intermediate / advanced)
- Variant: ${variant}

OUTPUT RULES:
Return ONLY valid JSON (no markdown, no extra text).
Use short, clear sentences.
For beginner: prefer N5–N4 grammar, very simple words.
For intermediate: N4–N3.
For advanced: natural workplace Japanese (still polite).

ROMAJI RULE:
- Use Hepburn-style romaji.
HIRAGANA RULE:
- "hira" must be Japanese hiragana only (no kanji).
- For names/loanwords, write as natural hiragana as much as possible.

SAFETY:
- No medical diagnosis. If emergency risk, advise to call nurse/supervisor.

You must produce:
{
  "user": { "hira": "", "romaji": "", "id": "" },
  "ai": { "hira": "", "romaji": "", "id": "" },
  "feedback_jp": "",
  "suggested": { "hira": "", "romaji": "", "id": "" }
}
Notes:
- "user" should be the user's utterance normalized into the 3 languages:
  - If user wrote Indonesian: create a natural caregiver Japanese equivalent (hira) + romaji + original meaning in Indonesian (id).
  - If user wrote Japanese: convert it to hiragana (hira) + romaji + Indonesian translation (id).
      `.trim();

      const userPayload = {
        input: String(prompt),
        user_language_hint: userLang,
        recent_context: ctx
      };

      const result = await callOpenAI({
        system,
        user: JSON.stringify(userPayload, null, 2),
        temperature: 0.35,
        maxTokens: 900
      });

      if (!result.ok) return res.status(502).json({ error: "OpenAI error", details: result.body });

      // 軽いバリデーション（欠けていても返す）
      const out = result.json || {};
      return res.status(200).json({
        user: out.user || {},
        ai: out.ai || {},
        feedback_jp: out.feedback_jp || "",
        suggested: out.suggested || {},
        trace: { persona, scene, category, level, variant }
      });
    }

    return res.status(400).json({ error: "Invalid stage" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
