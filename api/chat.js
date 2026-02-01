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
      voice: "声かけ（安心・説明）",
      temperature: "温度確認",
      privacy: "羞恥・プライバシー",
      refusal: "拒否対応",
      safety: "安全配慮",
      start: "開始/準備",
      swallow: "嚥下/むせ",
      pace: "ペース調整",
      urge: "誘導/声かけ",
      transfer: "移乗/立位",
      accident: "失敗/汚染",
      hygiene: "清潔/後始末",
      sleep: "眠れない",
      anxiety: "不安/混乱",
      pain: "痛み/体調",
      wander: "徘徊/起き上がり",
      apology: "謝罪/受容",
      fact: "事実確認",
      plan: "対応方針",
      escalate: "上席/連携",
      followup: "報告/再発防止"
    };

    // 介護頻出語の正確な読み辞書
    const KAIGO_DICTIONARY = `
【重要】以下の介護用語は必ずこの読み方を使用すること：

一口ずつ → ひとくちずつ（NOT いっこうずつ or いっこくずつ）
少しずつ → すこしずつ
ゆっくり → ゆっくり
大丈夫 → だいじょうぶ
お大事に → おだいじに
準備 → じゅんび
できる → できる
いきます → いきます
お願い → おねがい
お手伝い → おてつだい
召し上がる → めしあがる
温かい → あたたかい
冷たい → つめたい
気持ちいい → きもちいい
痛い → いたい
苦しい → くるしい
お風呂 → おふろ
食事 → しょくじ
トイレ → といれ
お茶 → おちゃ
お水 → おみず
背中 → せなか
足 → あし
手 → て
頭 → あたま
体 → からだ
右 → みぎ
左 → ひだり
上 → うえ
下 → した
前 → まえ
後ろ → うしろ
立つ → たつ
座る → すわる
寝る → ねる
起きる → おきる
歩く → あるく
待つ → まつ
教える → おしえる
聞く → きく
見る → みる
話す → はなす
笑う → わらう
泣く → なく
怒る → おこる
喜ぶ → よろこぶ
心配 → しんぱい
安心 → あんしん
元気 → げんき
具合 → ぐあい
様子 → ようす
時間 → じかん
今日 → きょう
明日 → あした
昨日 → きのう
朝 → あさ
昼 → ひる
夜 → よる
午前 → ごぜん
午後 → ごご
    `.trim();

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
- Example: "ありがとう" → "arigatou" (NOT "arigato")
- Example: "〜ます" → "masu" (NOT "mas")

HIRAGANA CONVERSION RULES (CRITICAL):
- "hira" must be ONLY hiragana (no kanji, no katakana).
- Use the MOST COMMON READING (訓読み preferred for daily words).
- Follow the dictionary below EXACTLY for care-related terms.
- When uncertain, use kun-yomi (訓読み) not on-yomi (音読み).

${KAIGO_DICTIONARY}

EXAMPLES OF CORRECT HIRAGANA CONVERSION:
❌ WRONG: "一口ずついきますね" → "いっこうずついきますね" or "いっこくずついきますね"
✅ CORRECT: "一口ずついきますね" → "ひとくちずついきますね"

❌ WRONG: "少しずつ召し上がってください" → "しょうしずつめしあがってください"
✅ CORRECT: "少しずつ召し上がってください" → "すこしずつめしあがってください"

❌ WRONG: "お大事に" → "おおじに"
✅ CORRECT: "お大事に" → "おだいじに"

SAFETY:
- No medical diagnosis. If emergency risk, advise to call nurse/supervisor.

You must produce:
{
  "user": { "hira": "", "romaji": "", "id": "" },
  "ai": { "hira": "", "romaji": "", "id": "" },
  "feedback_jp": "",
  "suggested": { "hira": "", "romaji": "", "id": "" },
  "annotations": {
    "danger_words": [ { "hira": "", "romaji": "", "level": "high|medium|low", "note_jp": "" } ],
    "keigo_points": [ { "phrase_hira": "", "phrase_romaji": "", "note_jp": "" } ],
    "vocab": [ { "hira": "", "romaji": "", "id": "", "note_jp": "" } ]
  },
  "score": { "scene_skill": 1, "reason_jp": "", "next_focus_hira": [""] }
}

Notes:
- "user" should be the user's utterance normalized into the 3 languages:
  - If user wrote Indonesian: create a natural caregiver Japanese equivalent (hira) + romaji + original meaning in Indonesian (id).
  - If user wrote Japanese: convert it to hiragana (hira) + romaji + Indonesian translation (id).
  - CRITICAL: Use the dictionary above for accurate hiragana conversion.
- "ai" is your response as the ${personaInfo.ai_role} in this scene.
- "suggested" is an alternative/better way the user could have said it (if applicable).
- "annotations" helps learning:
  - danger_words: choking/fall/pain etc related words that appear or are important for the scene (max 5). "hira" must be hiragana only.
  - keigo_points: polite phrases used or recommended for the scene (max 5). "phrase_hira" must be hiragana only.
  - vocab: useful new words for this scene (max 6). "hira" must be hiragana only.
  - If nothing, use empty arrays.
- "score.scene_skill": 1–5 score of the user's utterance appropriateness/politeness for this scene (5 is best).
      `.trim();

      const userPayload = {
        input: String(prompt),
        user_language_hint: userLang,
        recent_context: ctx
      };

      const result = await callOpenAI({
        system,
        user: JSON.stringify(userPayload, null, 2),
        temperature: 0.3, // 低めにして安定性向上
        maxTokens: 900
      });

      if (!result.ok) return res.status(502).json({ error: "OpenAI error", details: result.body });

      const out = result.json || {};
      return res.status(200).json({
        user: out.user || {},
        ai: out.ai || {},
        feedback_jp: out.feedback_jp || "",
        suggested: out.suggested || {},
        annotations: out.annotations || { danger_words: [], keigo_points: [], vocab: [] },
        score: out.score || {},
        trace: { persona, scene, category, level, variant }
      });
    }

    // STAGE 1, 2 の処理は省略（stage 3 のみ使用を想定）
    return res.status(400).json({ error: "Invalid stage or stage not implemented" });

  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
