export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ error: "Method not allowed", message: "POST only" });
    }

    const { prompt, meta } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const persona = meta?.persona || "user_calm";
    const scene = meta?.scene || "bath";
    const stage = Number(meta?.stage || 1); // 1 or 2

    // Scenario mappings
    const personaMap = {
      user_calm: {
        label: "利用者：穏やか（協力的）",
        ai_role: "resident",
        ai_tone_jp: "落ち着いていて協力的。短く丁寧に返す。"
      },
      user_angry: {
        label: "利用者：怒り（強めの口調）",
        ai_role: "resident",
        ai_tone_jp: "不満・苛立ちが強い。言葉が荒くなりやすい。"
      },
      dementia: {
        label: "利用者：少し混乱（認知症の入口）",
        ai_role: "resident",
        ai_tone_jp: "時間・場所の見当識が揺らぐ。短い文で混乱気味に話す。"
      },
      family_anxious: {
        label: "家族：不安（心配が強い）",
        ai_role: "family",
        ai_tone_jp: "心配で質問が多い。丁寧だが不安が滲む。"
      },
      family_complaint: {
        label: "家族：クレーム（怒り・要求）",
        ai_role: "family",
        ai_tone_jp: "強めのクレーム。事実確認と要求が中心。"
      }
    };

    const sceneMap = {
      bath: { label: "入浴介助", jp: "入浴の声かけ・安全確認・羞恥配慮。" },
      meal: { label: "食事介助", jp: "食事のペース調整・誤嚥予防・励まし。" },
      toilet: { label: "排泄介助", jp: "排泄誘導・プライバシー配慮・体調確認。" },
      night: { label: "夜間対応", jp: "不安・不眠・見守り・転倒予防。" },
      complaint: { label: "苦情・クレーム", jp: "謝罪・傾聴・事実確認・次の対応提示。" }
    };

    const personaInfo = personaMap[persona] || personaMap.user_calm;
    const sceneInfo = sceneMap[scene] || sceneMap.bath;

    // Helper: OpenAI call with timeout
    async function callOpenAI(bodyObj, timeoutMs = 25000) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyObj),
          signal: controller.signal
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          return { ok: false, status: r.status, data };
        }
        return { ok: true, status: r.status, data };
      } catch (e) {
        const msg =
          e?.name === "AbortError" ? "Upstream timeout" : String(e?.message || e);
        return { ok: false, status: 504, data: { error: msg } };
      } finally {
        clearTimeout(t);
      }
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // ------------------------------------------------------------
    // STAGE 1: Generate JP only (B: ai_reply_jp + suggested_reply_jp + feedback_jp)
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
        "- Safety and dignity first (privacy, reassurance, fall prevention, consent)."
      ].join("\n");

      const userContent =
        `Caregiver said (Japanese):\n${prompt}\n\n` +
        `Keys: persona_key=${persona}, scene_key=${scene}`;

      const result = await callOpenAI({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent }
        ]
      });

      if (!result.ok) {
        return res
          .status(result.status)
          .json({ error: "OpenAI API error", details: result.data });
      }

      const text = result.data?.choices?.[0]?.message?.content ?? "";
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      return res.status(200).json({
        stage: 1,
        text,
        json,
        trace: { persona, scene }
      });
    }

    // ------------------------------------------------------------
    // STAGE 2: Convert ONLY (Romaji + Indonesian) from stage1 JP outputs
    // ------------------------------------------------------------
    if (stage === 2) {
      const jp = meta?.jp; // { ai_reply_jp, suggested_reply_jp, feedback_jp }
      if (!jp?.ai_reply_jp || !jp?.suggested_reply_jp) {
        return res.status(400).json({
          error: "Missing meta.jp",
          message:
            'Call stage=2 with meta.jp: { ai_reply_jp, suggested_reply_jp, feedback_jp }'
        });
      }

      const system = [
        "You are a careful converter.",
        "Convert Japanese text to (1) easy-to-read romaji and (2) simple natural Indonesian.",
        "Do NOT add new meaning. Do NOT invent extra content.",
        "Return ONLY valid JSON (no markdown, no extra text).",
        "Schema:",
        "{",
        '  "ai_reply_romaji": "...",',
        '  "ai_reply_id": "...",',
        '  "suggested_reply_romaji": "...",',
        '  "suggested_reply_id": "..."',
        "}",
        "Rules:",
        "- Romaji should be readable for beginners (avoid overly academic Hepburn details).",
        "- Indonesian should be short, polite, natural."
      ].join("\n");

      const userContent = [
        "Convert the following.",
        "",
        "[ai_reply_jp]",
        jp.ai_reply_jp,
        "",
        "[suggested_reply_jp]",
        jp.suggested_reply_jp
      ].join("\n");

      const result = await callOpenAI({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent }
        ]
      });

      if (!result.ok) {
        return res
          .status(result.status)
          .json({ error: "OpenAI API error", details: result.data });
      }

      const text = result.data?.choices?.[0]?.message?.content ?? "";
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      return res.status(200).json({
        stage: 2,
        text,
        json,
        trace: { persona, scene }
      });
    }

    return res
      .status(400)
      .json({ error: "Invalid stage", message: "stage must be 1 or 2" });
  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      details: String(e?.message || e)
    });
  }
}
