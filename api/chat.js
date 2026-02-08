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
    const plan = meta?.plan || "trainee_lite"; // NEW: プラン情報
    const ctx = Array.isArray(meta?.ctx) ? meta.ctx.slice(-6) : [];

    // ========== 4-TIER PLAN SETTINGS ==========
    
    const PLAN_SETTINGS = {
      trainee_lite: {
        plan_name: "trainee ライト",
        daily_limit: 30,
        vocabulary_level: "N5-only",
        vocabulary_count: 500,
        max_sentence_words: 10,
        max_sentence_chars: 40,
        max_tokens: 400,
        use_simple_grammar: true,
        grammar_types: ["basic_form_only"],
        provide_hints: true,
        feedback_style: "very_encouraging",
        feedback_length: "short",
        include_romaji: true,
        include_indonesian: true,
        scenarios: ["greeting", "meal_basic", "bath_basic"],
        save_examples: false,
        learning_analysis: false,
        customization: false,
        support_level: "faq_only",
        audio_quality: "standard"
      },
      trainee_standard: {
        plan_name: "trainee スタンダード",
        daily_limit: 70,
        vocabulary_level: "N5-N4",
        vocabulary_count: 1500,
        max_sentence_words: 15,
        max_sentence_chars: 70,
        max_tokens: 600,
        use_simple_grammar: true,
        grammar_types: ["desu_masu", "te_form"],
        provide_hints: true,
        feedback_style: "encouraging",
        feedback_length: "medium",
        include_romaji: true,
        include_indonesian: true,
        scenarios: ["greeting", "meal", "bath", "toilet", "night"],
        save_examples: true,
        save_limit: 50,
        learning_analysis: "simple",
        customization: false,
        support_level: "email_72h",
        audio_quality: "standard"
      },
      ssw_standard: {
        plan_name: "ssw スタンダード",
        daily_limit: 100,
        vocabulary_level: "N4-N3",
        vocabulary_count: 3000,
        max_sentence_words: 25,
        max_sentence_chars: 120,
        max_tokens: 800,
        use_simple_grammar: false,
        grammar_types: ["keigo", "passive", "causative"],
        provide_hints: false,
        feedback_style: "professional",
        feedback_length: "detailed",
        include_romaji: false,
        include_indonesian: false,
        scenarios: ["all_basic", "family_consultation", "team_coordination", "incident_reporting"],
        save_examples: true,
        save_limit: 200,
        learning_analysis: "detailed",
        customization: "scenario_selection",
        support_level: "email_24h",
        audio_quality: "high"
      },
      ssw_professional: {
        plan_name: "ssw プロフェッショナル",
        daily_limit: 999999,
        vocabulary_level: "N3-N2",
        vocabulary_count: 6000,
        max_sentence_words: 35,
        max_sentence_chars: 180,
        max_tokens: 1000,
        use_simple_grammar: false,
        grammar_types: ["keigo_advanced", "honorific", "humble", "complex_conditionals"],
        provide_hints: false,
        feedback_style: "expert",
        feedback_length: "comprehensive",
        include_romaji: false,
        include_indonesian: false,
        scenarios: ["all", "medical_coordination", "advanced_family", "leadership", "training"],
        save_examples: true,
        save_limit: 999999,
        learning_analysis: "ai_powered",
        customization: "full",
        support_level: "priority_12h",
        audio_quality: "premium"
      }
    };

    const planConfig = PLAN_SETTINGS[plan] || PLAN_SETTINGS.trainee_lite;

    // ========== PERSONAS ==========
    
    const PERSONAS = {
      user_calm: { label: "利用者：穏やか", ai_role: "resident", ai_tone: "calm, cooperative, polite" },
      user_angry: { label: "利用者：怒り", ai_role: "resident", ai_tone: "irritated, defensive, short answers" },
      dementia: { label: "利用者：少し混乱", ai_role: "resident", ai_tone: "confused, needs reassurance, short sentences" },
      family_anxious: { label: "家族：不安", ai_role: "family", ai_tone: "worried, asks safety questions" },
      family_complaint: { label: "家族：クレーム", ai_role: "family", ai_tone: "complaining, expects apology and plan" },
      colleague: { label: "同僚（次の勤務者）", ai_role: "coworker", ai_tone: "brief, practical, supportive, asks for key details" },
      leader: { label: "リーダー／主任", ai_role: "team_leader", ai_tone: "calm, decisive, confirms risks and assigns actions" },
      nurse: { label: "看護師", ai_role: "nurse", ai_tone: "clinical, calm, asks focused assessment questions" },
      head_nurse: { label: "師長", ai_role: "head_nurse", ai_tone: "professional, checks reporting quality and safety escalation" },
      doctor: { label: "医師", ai_role: "doctor", ai_tone: "clinical, concise, gives orders and asks for essential vitals" }
    };

    const SCENES = {
      bath: { label: "入浴", focus: "privacy, consent, temperature, fall prevention" },
      meal: { label: "食事", focus: "posture, choking risk, pace, dignity" },
      toilet: { label: "排泄", focus: "privacy, timely assistance, hygiene" },
      night: { label: "夜間", focus: "anxiety, insomnia, wandering risk" },
      complaint: { label: "クレーム対応", focus: "apology, fact-finding, plan" },
      family_consultation: { label: "家族相談", focus: "clear explanation, empathy, professional" },
      team_coordination: { label: "チーム連携", focus: "reporting, coordination, clarity" },
      incident_reporting: { label: "事故報告", focus: "accuracy, timeline, action plan" },
      medical_coordination: { label: "医療連携", focus: "professional terminology, urgency assessment" },
      leadership: { label: "リーダーシップ", focus: "delegation, motivation, problem-solving" }
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

【急変・医学用語】以下は医学用語として一般的な読み／言い回しを優先する：

発熱 → ねつ が ある
息苦しさ → いきが くるしい
意識変容 → いしき の へんか
嘔吐 → おうと
胸痛 → むね の いたみ
低血糖 → ていけっとう
血糖 → けっとう
SpO2 → えすぴーおーつー

    `.trim();

    const personaInfo = PERSONAS[persona] || PERSONAS.user_calm;
    const sceneInfo = SCENES[scene] || SCENES.bath;
    const categoryLabel = CATEGORIES[category] || category;


    // ===== ROLEPLAY RESPONSE TEMPLATES (現場ロールを成立させる) =====
    const maxQuestions = (plan === "trainee_lite") ? 1 : (plan === "trainee_standard") ? 2 : 3;

    function buildRoleplayGuidance(sceneKey, personaKey){
      // Keep this guidance short; the model must still obey max length constraints.
      if (!sceneKey || !personaKey) return "";

      // Emergency (急変)
      if (sceneKey === "emergency"){
        if (personaKey === "nurse"){
          return [
            "ROLEPLAY: You are a NURSE responding to an acute change.",
            `Ask up to ${maxQuestions} short assessment questions (vitals/when/mental state/actions).`,
            "Prefer these quick checks (pick only what fits): いつから / えすぴーおーつー / いしき / けつあつ / たいおう",
            "End with a clear next action: すぐ かくにん します / いし に れんらく します など。",
            "DO NOT include SBAR headings like S/B/A/R in ai.hira."
          ].join("\n");
        }
        if (personaKey === "doctor"){
          return [
            "ROLEPLAY: You are a DOCTOR giving instructions based on a report.",
            `Ask up to ${maxQuestions} essentials (えすぴーおーつー/けつあつ/いしき/けっとう).`,
            "Give 1–2 clear orders (e.g., さんそ / けいかんさつ / きゅうきゅう そうだん).",
            "DO NOT include SBAR headings like S/B/A/R in ai.hira."
          ].join("\n");
        }
        if (personaKey === "head_nurse"){
          return [
            "ROLEPLAY: You are the HEAD NURSE.",
            "Confirm urgency, request structured info (じけいれつ/すうち/たいおう), and instruct escalation if needed.",
            "Keep it professional and calm."
          ].join("\n");
        }
        if (personaKey === "leader"){
          return [
            "ROLEPLAY: You are the TEAM LEADER.",
            "Instruct to call nurse/doctor, ensure safety, and assign next actions (きろく/ほうこく).",
            "Keep it brief and decisive."
          ].join("\n");
        }
      }

      // Fall (転倒)
      if (sceneKey === "fall"){
        if (personaKey === "nurse" || personaKey === "head_nurse"){
          return [
            "ROLEPLAY: You are nursing staff responding to a fall.",
            `Ask up to ${maxQuestions} focused checks: あたま を うった か / しゅっけつ / いたみ / いしき / ばいたる.`,
            "Instruct next action: あんせい / かんさつ / いし へ れんらく / きろく.",
            "No long explanations."
          ].join("\n");
        }
        if (personaKey === "leader" || personaKey === "colleague"){
          return [
            "ROLEPLAY: You are a coworker/leader receiving a fall report.",
            "Confirm key facts (いつ/どこ/じょうきょう/けが/たいおう) and assign next steps.",
            "Professional and concise."
          ].join("\n");
        }
      }

      // Handover (申し送り)
      if (sceneKey === "handover"){
        if (personaKey === "colleague"){
          return [
            "ROLEPLAY: You are a coworker receiving a handover.",
            "Acknowledge and confirm the 5 items: しょくじ / すいぶん / はいせつ / すいみん / ちゅういてん.",
            "Ask ONE clarification if needed, otherwise confirm next task.",
            "Keep it friendly and practical."
          ].join("\n");
        }
        if (personaKey === "leader"){
          return [
            "ROLEPLAY: You are the leader receiving a handover.",
            "Confirm risks and priorities, and assign actions (みまもり/ほうこく/かくにん).",
            "Concise."
          ].join("\n");
        }
      }

      return "";
    }

    const roleplayGuidance = buildRoleplayGuidance(scene, persona);

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

    // ========== STAGE 3: PLAN-AWARE PROMPT ==========
    
    if (stage === 3) {
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      // Plan-specific prompt generation
      let planPromptModifier = "";

      if (plan === "trainee_lite") {
        planPromptModifier = `
========== TRAINEE LITE MODE (超入門者向け) ==========

TARGET: Absolute beginners (JLPT N5 or below), just starting Japanese
VOCABULARY: ONLY N5 vocabulary (約500語) - the most basic daily words
SENTENCE LENGTH: VERY SHORT (30-40 characters MAXIMUM, 10 words max)
GRAMMAR: Basic form ONLY (dictionary form, no です・ます, no te-form)

COMMUNICATION STYLE:
- Use THE SIMPLEST possible expressions
- ONE idea per sentence
- Use ONLY the most common words
- NO complex grammar at all
- Heavy use of hiragana
- Be extremely patient and encouraging

EXAMPLES OF APPROPRIATE LANGUAGE:
✅ "はい。ゆっくり たべて。" (12 chars) → "Hai. Yukkuri tabete."
✅ "だいじょうぶ。" (7 chars) → "Daijoubu."
✅ "いま おふろ いく。" (9 chars) → "Ima ofuro iku."

ABSOLUTELY AVOID:
❌ "ゆっくりでだいじょうぶですよ" (too long, です form)
❌ "お風呂に入りますか？" (ます form, に particle too advanced)
❌ "少量ずつ召し上がってください" (complex, keigo)

FEEDBACK STYLE: 
- Very short (30 chars max)
- Use emojis 👏 😊
- Only positive encouragement
- NO specific corrections (too advanced for beginners)

FEEDBACK EXAMPLE:
"よくできました！👏 つぎも がんばりましょう。"
`;
      } else if (plan === "trainee_standard") {
        planPromptModifier = `
========== TRAINEE STANDARD MODE (技能実習生標準) ==========

TARGET: Beginners (JLPT N5-N4), 3 months to 1 year in Japan
VOCABULARY: N5-N4 vocabulary (約1,500語) - common daily expressions
SENTENCE LENGTH: Short (50-70 characters, 15 words max)
GRAMMAR: です・ます form, て-form, basic particles

COMMUNICATION STYLE:
- Use simple, clear expressions
- Break complex ideas into 2-3 short sentences
- Provide vocabulary hints for N4 words
- Give specific, actionable advice
- Be encouraging and supportive

EXAMPLES OF APPROPRIATE LANGUAGE:
✅ "はい、わかりました。いま、じゅんびしますね。ゆっくり たべてください。" (60 chars)
✅ "おふろに はいりますか？おんどは だいじょうぶですか？" (55 chars)
✅ "すこしずつ たべると、むせにくいですよ。" (45 chars)

AVOID:
❌ "お召し上がりください" (too formal, keigo)
❌ "入浴なさいますか" (too formal)
❌ Complex conditional forms
❌ Passive/causative forms

FEEDBACK STYLE:
- Medium length (60-80 chars)
- Point out 1-2 good things
- Give 1 specific improvement
- Provide example phrase to practice

FEEDBACK EXAMPLE:
"よくできました！😊

良かった点：
- ていねいに こえを かけていました

つぎは こうすると よいです：
- 「ゆっくり」のあとに「どうぞ」をつけると、もっと ていねいになります

れんしゅうフレーズ：
ゆっくり どうぞ → yukkuri douzo"
`;
      } else if (plan === "ssw_standard") {
        planPromptModifier = `
========== SSW STANDARD MODE (特定技能実務者向け) ==========

TARGET: Experienced caregivers (JLPT N4-N3), 1-2 years work experience
VOCABULARY: N4-N3 vocabulary (約3,000語) including professional terminology
SENTENCE LENGTH: Standard workplace (80-120 characters, 25 words max)
GRAMMAR: Keigo (謙譲語・尊敬語), passive, causative forms appropriate

COMMUNICATION STYLE:
- Use realistic workplace Japanese
- Include professional care terminology
- Expect appropriate keigo usage
- Provide context-aware professional feedback
- Present complex but realistic scenarios

REALISTIC SCENARIOS:
- Family inquiries about care quality
- Coordination with medical staff
- Handling challenging behaviors
- Team communication under stress
- Documentation and reporting

EXAMPLES OF APPROPRIATE LANGUAGE:
✅ "かしこまりました。ただいま、おしょくじの じゅんびを させていただきます。おせきに おすわりいただけますでしょうか。あたたかいうちに、ゆっくり おめしあがりください。" (100 chars)
✅ "ごかぞくのかたに じょうきょうを ごせつめい させていただきます。" (70 chars)
✅ "かんごしに ほうこくして、しじを あおぎます。" (50 chars)

INCLUDE:
✅ 謙譲語: させていただく、申し上げる、伺う
✅ 尊敬語: いらっしゃる、お〜になる、召し上がる
✅ Professional terms: 利用者様、ご家族、施設、報告

FEEDBACK STYLE:
- Structured format (100-150 chars)
- Analyze strengths (2-3 points)
- Provide specific improvements (2 points)
- Give Before/After examples
- Assign practice tasks

FEEDBACK EXAMPLE:
"プロフェッショナルな たいおうです。

◆ つよみ ぶんせき：
- けいごの つかいわけが せいかく
- だんかいてきな せつめいが できている
- あいての たちばを こうりょ している

◆ かいぜん ていあん：
1. クッションことばの ついか
   Before: 「ほうこく します」
   After: 「おそれいりますが、ごほうこく させていただきます」

2. ぐたいせいの こうじょう
   Before: 「かいぜん します」
   After: 「あすまでに かいぜんさくを ごていあん いたします」

◆ れんしゅう かだい：
つぎかいは、より ぐたいてきな じかんや ほうほうを しめしてみましょう。"
`;
      } else if (plan === "ssw_professional") {
        planPromptModifier = `
========== SSW PROFESSIONAL MODE (リーダー・管理職候補向け) ==========

TARGET: Advanced caregivers/leaders (JLPT N3-N2), leadership roles
VOCABULARY: N3-N2 vocabulary (約6,000語) including medical/management terms
SENTENCE LENGTH: Professional detailed (120-180 characters, 35 words max)
GRAMMAR: Advanced keigo, complex sentence structures, formal documentation style

COMMUNICATION STYLE:
- Use sophisticated professional Japanese
- Include medical/management terminology
- Expect nuanced keigo and situational appropriateness
- Provide detailed analytical feedback with metrics
- Present complex, high-stakes scenarios

ADVANCED SCENARIOS:
- Critical incident management
- Multi-stakeholder coordination
- Staff training and mentoring
- Policy compliance and documentation
- Quality improvement initiatives

EXAMPLES OF APPROPRIATE LANGUAGE:
✅ "しょうちいたしました。それでは、おしょくじの じゅんびを させていただきます。ほんじつの メニューは、さばの みそにと おんやさい サラダでございます。おせきに おすわりいただけますでしょうか。しせいを ととのえて、せもたれに もたれていただきますと、ごえんの リスクが へります。おのみものは、おちゃと おみず、どちらが よろしいでしょうか。あたたかいうちに、ゆっくりと おめしあがりください。" (180 chars)

✅ "やかんに りようしゃが てんとうし、がいしょうを かくにんいたしました。まず、バイタルサインを そくていし、いしきレベルを かくにんしてください。そのご、かんごしに ほうこくし、ごかぞくへの れんらくについても しじを あおいでください。じこ ほうこくしょは、てんとう じこく、はっけん じょうきょう、がいしょうの ぶいと ていどを しょうさいに きろくしてください。ひつような ばあいは、きゅうきゅう はんそうの てはいも おねがいいたします。" (180 chars)

INCLUDE:
✅ 高度敬語: ご〜いただく、お〜申し上げる、ご〜くださいませ
✅ Medical terms: バイタルサイン、意識レベル、誤嚥リスク
✅ Management terms: 連携、調整、評価、改善策

FEEDBACK STYLE:
- Comprehensive analysis (200+ chars)
- Quantitative scores (1-100%)
- Multi-dimensional evaluation
- Detailed improvement roadmap
- Growth tracking over time
- Personalized learning path

FEEDBACK EXAMPLE:
"◆ そうごう ひょうか: A（ゆうしゅう）

◆ しょうさい ぶんせき:
1. けいごの せいかくせい: 95%（ゆうしゅう）
   ✓ けんじょうごの つかいわけが てきせつ
   ✓ クッションことばを こうかてきに しよう
   △ 「お〜する」けいが 1かしょ ふそく

2. じょうきょう はんだんりょく: 90%（りょうこう）
   ✓ きんきゅうどの にんしきが せいかく
   ✓ ほうこくすべき あいてを ただしく はんだん
   △ かぞくへの れんらく タイミングの げんきゅうが ふそく

3. でんたつの めいかくせい: 85%（りょうこう）
   ✓ 5W1Hが そろっている
   △ じけいれつの せいりが やや ふそく

◆ こべつ アドバイス:
【けいご】
- かいぜんれい: 「かくにんしました」→「かくにんいたしました」
- りゆう: いりょう・かいご げんばでは、より ていねいな けんじょうごが もとめられます

【じょうきょう はんだん】
- ついかすべき ようそ: 「ごかぞくには、じょうきょう かくにんご、すみやかに ごれんらく いたします」
- りゆう: かぞく たいおうの ほうしんを じぜんに しめすことで、しんらいかんが たかまります

◆ じかいの れんしゅう かだい:
1. じこ はっせいから ほうこくまでの じけいれつを、より めいかくに こうぞうかする
2. かぞくへの せつめい シミュレーション（かんじょうてきな しつもんへの たいおう）
3. たしょくしゅ れんけい（いし・かんごし・ケアマネージャー）の シナリオ

◆ あなたの せいちょう きろく:
- せんしゅうひ: けいご スコア +5pt
- せんげつひ: そうごう ひょうか B→A
- つよみの けいこう: クレーム たいおう、じょうきょう はんだん
- こんごの のびしろ: いりょう れんけい、ぶんしょ さくせい"
`;
      }

      const system = `
You are "AIGA", an AI roleplay partner for training caregivers working in Japanese elderly care facilities.

${planPromptModifier}

CURRENT ROLEPLAY SETUP:
- Plan: ${planConfig.plan_name}
- Scene: ${sceneInfo.label} (${sceneInfo.focus})
- Category: ${categoryLabel}
- Persona: ${personaInfo.label}
- Role you play: ${personaInfo.ai_role}
- Tone: ${personaInfo.ai_tone}
- Target Level: ${planConfig.vocabulary_level} (${planConfig.vocabulary_count} words)
- Max Response Length: ${planConfig.max_sentence_chars} characters

${roleplayGuidance ? ('ROLEPLAY GUIDANCE:\n' + roleplayGuidance + '\n') : ''}
OUTPUT RULES:
Return ONLY valid JSON (no markdown, no extra text).

CRITICAL LENGTH CONSTRAINTS:
- Your AI response ("ai.hira") MUST be under ${planConfig.max_sentence_chars} characters
- If ${plan === 'trainee_lite'}, keep it 30-40 chars
- If ${plan === 'trainee_standard'}, keep it 50-70 chars
- If ${plan === 'ssw_standard'}, keep it 80-120 chars
- If ${plan === 'ssw_professional'}, keep it 120-180 chars

ROMAJI RULE:
- Use Hepburn-style romaji

HIRAGANA CONVERSION RULES (CRITICAL):
- "hira" must be ONLY hiragana (no kanji, no katakana)
- Use the MOST COMMON READING (訓読み preferred for daily words)
- Follow the dictionary below EXACTLY for care-related terms

${KAIGO_DICTIONARY}

SAFETY:
- No medical diagnosis
- If emergency risk, advise to call nurse/supervisor

YOU MUST PRODUCE:
{
  "user": { "hira": "", "romaji": "", "id": "" },
  "ai": { "hira": "", "romaji": "", "id": "" },
  "feedback_jp": "${planConfig.feedback_style} style, max ${planConfig.feedback_length === 'short' ? '30' : planConfig.feedback_length === 'medium' ? '80' : planConfig.feedback_length === 'detailed' ? '150' : '250'} chars",
  "suggested": { "hira": "", "romaji": "", "id": "" },
  "annotations": {
    "danger_words": [ { "hira": "", "romaji": "", "level": "high|medium|low", "note_jp": "" } ],
    "keigo_points": [ { "phrase_hira": "", "phrase_romaji": "", "note_jp": "" } ],
    "vocab": [ { "hira": "", "romaji": "", "id": "", "note_jp": "" } ]
  },
  "score": { "scene_skill": 1-5, "reason_jp": "", "next_focus_hira": [""] }
}

NOTES:
- "user" should be the user's utterance normalized into 3 languages
- "ai" is your response as the ${personaInfo.ai_role} in this scene (MUST follow length constraints!)
- "suggested" is an alternative/better way the user could have said it
- "annotations" helps learning (use empty arrays if not applicable)
- "score.scene_skill": 1-5 score of appropriateness/politeness
- ${planConfig.include_indonesian ? 'Include Indonesian translations' : 'Indonesian can be brief or omitted'}
- ${planConfig.provide_hints ? 'Provide helpful vocabulary hints' : 'Focus on professional feedback'}
      `.trim();

      const userPayload = {
        input: String(prompt),
        user_language_hint: userLang,
        recent_context: ctx
      };

      const result = await callOpenAI({
        system,
        user: JSON.stringify(userPayload, null, 2),
        temperature: 0.3,
        maxTokens: planConfig.max_tokens
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
        trace: { 
          persona, 
          scene, 
          category, 
          level, 
          variant, 
          plan: planConfig.plan_name,
          vocabulary_level: planConfig.vocabulary_level,
          max_chars: planConfig.max_sentence_chars
        }
      });
    }

    return res.status(400).json({ error: "Invalid stage" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
