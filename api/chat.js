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

	    // Human-readable mappings so the model truly changes by scenario.
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

	    const system = [
	      "You are Roleplay AI for a Japanese elderly care facility.",
	      "The USER is a caregiver. The AI plays the other side (resident or family).",
	      "Follow the scenario settings below strictly.",
	      "",
	      "[Scenario settings]",
	      `Persona: ${personaInfo.label}`,
	      `AI role: ${personaInfo.ai_role} (resident or family)` ,
	      `Tone/behavior (JP): ${personaInfo.ai_tone_jp}`,
	      `Scene: ${sceneInfo.label}`,
	      `Scene notes (JP): ${sceneInfo.jp}`,
	      "",
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
	      "- ai_reply_* : what the resident/family says next in Japanese, consistent with the persona and scene.",
	      "- suggested_reply_* : improved caregiver reply (short, polite, safe).",
	      "- ai_reply_romaji / suggested_reply_romaji: romaji for Indonesian learners (easy to read).",
	      "- ai_reply_id / suggested_reply_id: Indonesian translation (simple, natural).",
	      "- Keep it concise. 1-3 sentences each.",
	      "- If user input is empty/too short, still respond with something plausible for the scenario."
	    ].join("\n");

	    const context = `persona_key=${persona}\nscene_key=${scene}`;

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
