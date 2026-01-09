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
    const stage = Number(meta?.stage || 1); // 1 or 2

    const PERSONAS = {
      user_calm: {
        label: "利用者：穏やか",
        ai_role: "resident",
        ai_tone_jp: "calm, cooperative, polite"
      },
      user_angry: {
        label: "利用者：怒り",
        ai_role: "resident",
        ai_tone_jp: "irritated, defensive, short answers"
      },
      dementia: {
        label: "利用者：少し混乱",
        ai_role: "resident",
        ai_tone_jp: "confused, needs simple reassurance, short sentences"
      },
      family_anxious: {
        label: "家族：不安",
        ai_role: "family",
        ai_tone_jp: "worried, asks safety questions, wants clear explanation"
      },
      family_complaint: {
        label: "家族：クレーム",
        ai_role: "family",
        ai_tone_jp: "complaining, demands accountability, expects apology and plan"
      }
    };

    const SCENES = {
      bath: {
        label: "入浴",
        jp: "privacy, consent, temperature check, fall prevention"
      },
      meal: {
        label: "食事",
        jp: "posture, choking risk, pace, preferences, dignity"
      },
      toilet: {
        label: "排泄",
        jp: "privacy, timely assistance, safe transfer, hygiene, dignity"
      },
      night: {
        label: "夜間",
        jp: "anxiety, insomnia, wandering risk, fall prevention, reassurance"
      },
      complaint: {
        label: "クレーム対応",
        jp: "apology, fact-finding, plan, escalation, follow-up"
      }
    };

    const personaInfo = PERSONAS[persona] || PERSONAS.user_calm;
    const sceneInfo = SCENES[scene] || SCENES.bath;

    // ---------- helpers ----------
    const extractJson = (text) => {
      if (!text) return null;
      try { return JSON.parse(text); } catch (_) {}
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch (_) { return null; }
    };

    const getOutputText = (resp) => {
      // Responses API shapes vary; be defensive
      if (typeof resp?.output_text === "string") return resp.output_text;
      const out = resp?.output;
      if (Array.isArray(out) && out.length) {
        const c = out[0]?.content;
        if (Array.isArray(c) && c.length) {
          const t = c.find(x => x?.type === "output_text")?.text;
          if (t) return t;
          if (typeof c[0]?.text === "string") return c[0].text;
        }
      }
      return null;
    };

    async function callOpenAI({ system, user, temperature = 0.3, max_output_tokens = 500 }) {
      // Prefer Responses API
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature,
          max_output_tokens,
          response_format: { type: "json_object" },
          input: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ok: false, status: r.status, body: j };
      }
      const text = getOutputText(j);
      const parsed = extractJson(text) || j; // fallback
      return { ok: true, parsed };
    }

    // ------------------------------------------------------------
    // STAGE 1: Generate JP only
    // ------------------------------------------------------------
    if (stage === 1) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const system = [
        "You are Roleplay AI for a Japanese elderly care facility.",
        "The USER is a caregiver. The AI plays the other side (resident or family).",
        "Follow the scenario settings strictly.",
        "",
        `[Persona] ${personaInfo.label} / role=${personaInfo.ai_role}`,
        `[Tone JP] ${personaInfo.ai_tone_jp}`,
        `[Scene] ${sceneInfo.label} / notes: ${sceneInfo.jp}`,
        "",
        "Return ONLY valid JSON (no markdown, no extra text).",
        "Schema:",
        "{",
        '  "ai_reply_jp": "1-3 short sentences as resident/family",',
        '  "feedback_jp": "Very short coaching feedback for caregiver (1-2 sentences)",',
        '  "suggested_reply_jp": "Improved caregiver reply (short, polite, safe; 1-3 sentences)"',
        "}",
        "Rules:",
        "- Keep it concise.",
        "- Safety and dignity first (privacy, reassurance, fall prevention, consent).",
        "- Do not mention policy, do not add extra fields."
      ].join("\n");

      const userContent =
        `Caregiver said (Japanese):\n${prompt}\n\n` +
        "Generate the resident/family reply in Japanese, then coaching feedback, then a better caregiver reply.";

      const result = await callOpenAI({ system, user: userContent, temperature: 0.4, max_output_tokens: 450 });

      if (!result.ok) {
        return res.status(502).json({
          error: "Upstream error",
          message: "OpenAI request failed",
          details: result.body
        });
      }

      const out = result.parsed || {};
      return res.status(200).json({
        ai_reply_jp: out.ai_reply_jp || "",
        feedback_jp: out.feedback_jp || "",
        suggested_reply_jp: out.suggested_reply_jp || "",
        trace: { persona, scene }
      });
    }

    // ------------------------------------------------------------
    // STAGE 2: JP -> Romaji + Indonesian
    // ------------------------------------------------------------
    if (stage === 2) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const system = [
        "You are a careful Japanese language assistant.",
        "Task: convert Japanese caregiver reply into Romaji and Indonesian translation.",
        "Return ONLY valid JSON (no markdown, no extra text).",
        "Schema:",
        "{",
        '  "romaji": "Japanese in romaji (Hepburn-like, readable)",',
        '  "indonesian": "Natural Indonesian, polite, caregiver tone"',
        "}",
        "Rules:",
        "- Keep the meaning faithful.",
        "- Keep it concise.",
        "- Do not add extra fields."
      ].join("\n");

      const userContent =
        `Japanese caregiver reply:\n${prompt}\n\n` +
        "Convert it to romaji and Indonesian.";

      const result = await callOpenAI({ system, user: userContent, temperature: 0.2, max_output_tokens: 350 });

      if (!result.ok) {
        return res.status(502).json({
          error: "Upstream error",
          message: "OpenAI request failed",
          details: result.body
        });
      }

      const out = result.parsed || {};
      return res.status(200).json({
        romaji: out.romaji || "",
        indonesian: out.indonesian || "",
        trace: { persona, scene }
      });
    }

    return res.status(400).json({ error: "Invalid stage", message: "stage must be 1 or 2" });
  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      details: String(e?.message || e)
    });
  }
}
