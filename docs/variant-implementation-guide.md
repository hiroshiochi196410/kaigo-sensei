# trainee/ssw 差別化実装ガイド

## 📋 実装手順（8時間）

---

## ステップ1: config.json 更新（30分）

### trainee/config.json

```bash
# 1. バックアップ
cp app/trainee/config.json app/trainee/config.json.backup

# 2. 新しいconfig.jsonをコピー
cp trainee-config-v2.json app/trainee/config.json
```

**変更内容:**
- ✅ target_jlpt: "N5-N4" 追加
- ✅ available_levels 制限
- ✅ features 詳細設定
- ✅ pricing 情報追加
- ✅ learning_goals 明記

---

### ssw/config.json

```bash
# 1. バックアップ
cp app/ssw/config.json app/ssw/config.json.backup

# 2. 新しいconfig.jsonをコピー
cp ssw-config-v2.json app/ssw/config.json
```

**変更内容:**
- ✅ target_jlpt: "N4-N3" 追加
- ✅ available_levels を intermediate/advanced のみ
- ✅ features で高度機能フラグ
- ✅ exclusive_scenarios リスト
- ✅ 高価格帯のpricing

---

## ステップ2: API更新（3時間）

### api/chat.js を variant対応版に置き換え

```bash
# 1. バックアップ
cp api/chat.js api/chat.js.backup

# 2. 新しいchat.jsをコピー
cp chat-with-variant.js api/chat.js
```

**主な変更:**

#### VARIANT_SETTINGS 追加

```javascript
const VARIANT_SETTINGS = {
  trainee: {
    vocabulary_level: "N5-N4",
    max_sentence_words: 15,
    use_simple_grammar: true,
    provide_hints: true,
    feedback_style: "encouraging",
    include_romaji: true,
    include_indonesian: true
  },
  ssw: {
    vocabulary_level: "N4-N3",
    max_sentence_words: 25,
    use_simple_grammar: false,
    provide_hints: false,
    feedback_style: "professional",
    include_romaji: false,
    include_indonesian: false
  }
};
```

#### Variant-specific プロンプト

**trainee:**
- 短い文章（10-15単語）
- 簡単な文法のみ
- 励ましのフィードバック
- 語彙ヒント付き

**ssw:**
- 自然な長さ（15-25単語）
- 敬語・謙譲語を含む
- プロフェッショナルなフィードバック
- 複雑なシナリオ

---

## ステップ3: UI調整（2時間）

### trainee/index.html の微調整

```javascript
// config読み込み後、featuresに応じてUI調整

async function initApp() {
  CFG = await loadJson('./config.json');
  
  // trainee専用: ローマ字をデフォルト表示
  if (CFG.features?.show_romaji) {
    $("ttsSel").value = "roma";
  }
  
  // trainee専用: 難易度を制限
  if (CFG.available_levels) {
    filterLevelOptions(CFG.available_levels);
  }
  
  // UI要素の表示制御
  applyFeatureFlags(CFG.features);
}

function filterLevelOptions(availableLevels) {
  const levelSel = $("levelSel");
  const options = Array.from(levelSel.options);
  
  options.forEach(option => {
    if (!availableLevels.includes(option.value)) {
      option.disabled = true;
      option.style.display = 'none';
    }
  });
}

function applyFeatureFlags(features) {
  // ふりがな機能の表示/非表示
  if (!features?.show_furigana) {
    const furiganaToggle = $("furiganaToggle");
    if (furiganaToggle) furiganaToggle.style.display = 'none';
  }
  
  // インドネシア語の表示/非表示
  if (!features?.show_indonesian) {
    document.querySelectorAll('.tri .line:last-child').forEach(el => {
      el.style.display = 'none';
    });
  }
}
```

---

### ssw/index.html の調整

```javascript
async function initApp() {
  CFG = await loadJson('./config.json');
  
  // ssw専用: デフォルトでひらがなのみ
  if (!CFG.features?.show_romaji) {
    $("ttsSel").value = "hira";
    // ローマ字選択肢を非表示
    $("ttsSel").querySelector('[value="roma"]').style.display = 'none';
  }
  
  // ssw専用: 上級シナリオのみ表示
  if (CFG.exclusive_scenarios) {
    highlightAdvancedScenarios();
  }
}
```

---

## ステップ4: examples.json 差別化（2時間）

### trainee/examples.json（基礎重視）

基礎的な例文を追加:

```json
{
  "scenes": {
    "greeting": {
      "label": "挨拶・基本会話",
      "label_id": "Salam dasar",
      "examples": [
        {
          "jp": "おはようございます",
          "hira": "おはようございます",
          "romaji": "ohayou gozaimasu",
          "id": "Selamat pagi"
        },
        {
          "jp": "今日はいい天気ですね",
          "hira": "きょうはいいてんきですね",
          "romaji": "kyou wa ii tenki desu ne",
          "id": "Cuaca hari ini bagus ya"
        }
      ]
    },
    "meal": {
      "label": "食事介助（基礎）",
      "label_id": "Bantuan makan (dasar)",
      "examples": [
        {
          "jp": "ごはんの時間ですよ",
          "hira": "ごはんのじかんですよ",
          "romaji": "gohan no jikan desu yo",
          "id": "Waktunya makan"
        },
        {
          "jp": "ゆっくり食べてください",
          "hira": "ゆっくりたべてください",
          "romaji": "yukkuri tabete kudasai",
          "id": "Silakan makan pelan-pelan"
        }
      ]
    }
  }
}
```

---

### ssw/examples.json（高度重視）

専門的な例文を追加:

```json
{
  "scenes": {
    "family_consultation": {
      "label": "家族相談",
      "label_id": "Konsultasi keluarga",
      "examples": [
        {
          "jp": "お母様の最近の様子についてご説明させていただきます",
          "hira": "おかあさまのさいきんのようすについてごせつめいさせていただきます",
          "romaji": "okaasama no saikin no yousu ni tsuite gosetsumei sasete itadakimasu",
          "id": "Saya akan menjelaskan kondisi ibu Anda akhir-akhir ini"
        }
      ]
    },
    "team_coordination": {
      "label": "チーム連携",
      "label_id": "Koordinasi tim",
      "examples": [
        {
          "jp": "看護師に報告して、指示を仰ぎます",
          "hira": "かんごしにほうこくして、しじをあおぎます",
          "romaji": "kangoshi ni houkoku shite, shiji wo aogimasu",
          "id": "Saya akan melaporkan ke perawat dan meminta instruksi"
        }
      ]
    },
    "incident_reporting": {
      "label": "事故報告",
      "label_id": "Laporan insiden",
      "examples": [
        {
          "jp": "14時30分頃、居室で転倒されました。外傷はなく、意識は清明です",
          "hira": "じゅうよじさんじっぷんごろ、きょしつでてんとうされました。がいしょうはなく、いしきはせいめいです",
          "romaji": "juuyoji sanjuppun goro, kyoshitsu de tentou saremashita. gaishou wa naku, ishiki wa seimei desu",
          "id": "Sekitar pukul 14:30, jatuh di kamar. Tidak ada luka luar, kesadaran penuh"
        }
      ]
    }
  }
}
```

---

## ステップ5: テスト（1.5時間）

### テストケース

#### trainee のテスト

```
□ シンプルな応答が返る
  入力: "おはようございます"
  期待: 短い、励ましのある応答

□ ローマ字がデフォルト表示
  確認: 音声設定が "roma" になっている

□ 難易度制限
  確認: advanced が選択不可

□ インドネシア語表示
  確認: 3段表示すべて表示される

□ フィードバックが優しい
  確認: 「よくできました」「次は〜」など
```

---

#### ssw のテスト

```
□ 専門的な応答が返る
  入力: "家族からクレームがありました"
  期待: 敬語、具体的な対応提案

□ ひらがなのみ表示
  確認: デフォルトでローマ字OFF

□ 難易度制限
  確認: beginner が選択不可

□ インドネシア語非表示
  確認: 日本語のみ（またはオプション）

□ フィードバックがプロフェッショナル
  確認: 具体的、建設的な指摘
```

---

### 動作確認スクリプト

```bash
# Vercelローカル開発サーバー起動
vercel dev

# trainee をテスト
open http://localhost:3000/app/trainee/

# ssw をテスト
open http://localhost:3000/app/ssw/
```

---

## ステップ6: デプロイ（30分）

```bash
# 1. 変更をコミット
git add app/trainee/config.json
git add app/ssw/config.json
git add api/chat.js
git add app/trainee/examples.json (変更した場合)
git add app/ssw/examples.json (変更した場合)

git commit -m "feat: Differentiate trainee and ssw variants

- Add variant-specific config.json with target_jlpt and features
- Update chat.js with VARIANT_SETTINGS
- Implement trainee-specific prompts (N5-N4, simple grammar)
- Implement ssw-specific prompts (N4-N3, professional scenarios)
- Add feature flags for UI customization
- Separate examples for each target audience"

# 2. プッシュ
git push origin main

# 3. Vercel自動デプロイ（2-3分）

# 4. デプロイ確認
https://your-app.vercel.app/app/trainee/
https://your-app.vercel.app/app/ssw/
```

---

## 📊 検証ポイント

### trainee

```
✅ 短い文章（10-15単語）
✅ 簡単な語彙（N5-N4）
✅ 励ましのフィードバック
✅ ローマ字・インドネシア語表示
✅ 基礎シナリオ中心
```

### ssw

```
✅ 自然な長さ（15-25単語）
✅ 専門語彙（N4-N3）
✅ プロフェッショナルなフィードバック
✅ 日本語のみ
✅ 高度シナリオ中心
```

---

## 🎯 成功基準

### 定性評価

```
□ trainee使用時、初心者でも理解しやすい
□ ssw使用時、実務経験者向けの専門性が感じられる
□ 2つのvariantで明確な違いがある
□ ユーザーが自分に合ったvariantを選べる
```

### 定量評価

```
□ trainee: 平均応答長 < 50文字
□ ssw: 平均応答長 50-80文字
□ trainee: フィードバックに「よくできました」「がんばりましょう」等
□ ssw: フィードバックに「適切です」「さらに〜すると」等
```

---

## ⚠️ トラブルシューティング

### 問題1: variant が反映されない

**原因:** index.html が variant を正しく送信していない

**解決:**
```javascript
// trainee/index.html で確認
const meta = { 
  stage: 3, 
  scene, 
  persona, 
  category, 
  level, 
  user_lang, 
  variant: VARIANT,  // ← これが 'trainee' になっているか確認
  ctx 
};
```

---

### 問題2: 応答が長すぎる/短すぎる

**原因:** maxTokens 設定が適切でない

**解決:**
```javascript
// api/chat.js
const maxTokens = variant === 'trainee' ? 600 : 800;
```

---

### 問題3: インドネシア語が表示されない

**原因:** config.json の features 設定が反映されていない

**解決:**
```javascript
// index.html の applyFeatureFlags() を確認
if (!features?.show_indonesian) {
  // インドネシア語行を非表示
}
```

---

## 📝 次のステップ

差別化実装が完了したら:

1. **β版テスト** (3-5人 × 各variant)
2. **フィードバック収集**
3. **微調整**
4. **ローンチ準備へ進む**

---

## ✅ チェックリスト

実装完了前に確認:

```
□ trainee/config.json 更新
□ ssw/config.json 更新
□ api/chat.js 更新
□ UI調整（可能な範囲）
□ examples.json 差別化（オプション）
□ ローカルテスト（trainee）
□ ローカルテスト（ssw）
□ デプロイ
□ 本番環境テスト（trainee）
□ 本番環境テスト（ssw）
```

---

**実装時間: 約8時間**
**推奨: 1日で完了**
