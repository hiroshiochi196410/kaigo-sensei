# 4タイプ品質差別化 - 完全実装ガイド

## 📦 実装したファイル一覧

### 1. バックエンド（API）
- **chat-4tier.js** - 4タイプのプラン対応API
  - trainee_lite / trainee_standard / ssw_standard / ssw_professional
  - プランごとの応答長、語彙、文法、フィードバックの差別化

### 2. フロントエンド
- **index-4tier.html** - 4プラン選択ランディングページ
- **plan-manager.js** - プラン管理・使用回数制限ライブラリ

### 3. ドキュメント
- **pricing-strategy-60percent-profit.md** - 料金設定（利益率80%）
- **quality-differentiation-strategy.md** - 品質差別化戦略

---

## 🚀 実装手順（3ステップ）

### ステップ1: APIの置き換え（5分）

```bash
# 1. 現在のchat.jsをバックアップ
cp api/chat.js api/chat.js.backup

# 2. 新しいAPIをコピー
cp chat-4tier.js api/chat.js

# 3. Vercelに再デプロイ
git add api/chat.js
git commit -m "feat: 4-tier plan differentiation in API"
git push origin main
```

**変更点:**
- `meta.plan`パラメータの追加受付
- 4つのプラン設定（PLAN_SETTINGS）
- プランごとのプロンプト生成
- トークン数・応答長の制御

---

### ステップ2: フロントエンドの更新（10分）

#### 2-1. ランディングページの置き換え

```bash
# 1. 現在のindex.htmlをバックアップ
cp index.html index.html.backup

# 2. 新しいランディングページをコピー
cp index-4tier.html index.html

# 3. デプロイ
git add index.html
git commit -m "feat: 4-tier pricing landing page"
git push origin main
```

#### 2-2. プラン管理ライブラリの追加

```bash
# 1. plan-manager.jsを配置
cp plan-manager.js public/plan-manager.js

# または、trainee/ssw の各index.htmlに直接埋め込み
```

#### 2-3. 既存のアプリ（trainee/ssw）の更新

**trainee/index.html と ssw/index.html に以下を追加:**

```html
<!-- <head>内に追加 -->
<script src="/plan-manager.js"></script>

<!-- 使用回数表示エリアを追加 -->
<div id="usageInfo" style="padding:12px; background:#f3f4f6; border-radius:8px; margin-bottom:16px; text-align:center; font-weight:600;"></div>

<!-- 既存のチャット送信処理に追加 -->
<script>
// チャット送信前にチェック
async function sendMessage() {
  // 使用回数チェック
  if (!PlanManager.canUse()) {
    return; // 制限に達している場合はモーダル表示して終了
  }
  
  const prompt = document.getElementById('userInput').value;
  if (!prompt.trim()) return;
  
  // 既存の送信処理
  const currentPlan = PlanManager.getCurrentPlan();
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      meta: {
        persona: selectedPersona,
        scene: selectedScene,
        category: selectedCategory,
        level: selectedLevel,
        stage: 3,
        variant: VARIANT, // 'trainee' or 'ssw'
        plan: currentPlan, // ← 追加
        ctx: conversationHistory
      }
    })
  });
  
  // 使用回数をカウント
  PlanManager.recordUsage();
  
  // 以下、既存の処理...
}
</script>
```

---

### ステップ3: 環境変数の設定（Stripe連携準備）

```bash
# Vercel Dashboard → Settings → Environment Variables

# OpenAI（既存）
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4o-mini

# Stripe（新規追加）
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# 4プランのPrice ID
STRIPE_PRICE_ID_TRAINEE_LITE=price_xxxxx
STRIPE_PRICE_ID_TRAINEE_STANDARD=price_xxxxx
STRIPE_PRICE_ID_SSW_STANDARD=price_xxxxx
STRIPE_PRICE_ID_SSW_PROFESSIONAL=price_xxxxx
```

---

## 🧪 テスト手順

### ローカルテスト

```bash
# 1. Vercel CLIで開発サーバー起動
vercel dev

# 2. ブラウザで各プランをテスト
http://localhost:3000/

# 3. プラン選択後、以下を確認
```

### テストチェックリスト

#### trainee ライト
```
□ 応答が30-40文字以内
□ 超簡単な語彙のみ（N5）
□ フィードバックが短くて励まし中心
□ 30回使うと制限モーダルが表示
□ ローマ字+インドネシア語が表示
```

#### trainee スタンダード
```
□ 応答が50-70文字
□ N5-N4語彙
□ フィードバックに具体的助言
□ 70回使うと制限モーダルが表示
□ 例文保存ボタンが機能
```

#### ssw スタンダード
```
□ 応答が80-120文字
□ 敬語・専門用語を使用
□ フィードバックが構造化
□ 100回使うと制限モーダルが表示
□ ローマ字・インドネシア語が非表示
```

#### ssw プロフェッショナル
```
□ 応答が120-180文字
□ 謙譲語・尊敬語を使用
□ フィードバックがAI分析形式
□ 無制限で使える（制限なし）
□ 詳細な成長記録が表示
```

---

## 📊 動作確認（コンソールログ）

開発者ツールのコンソールで以下を実行して確認:

```javascript
// 現在のプランを確認
console.log(PlanManager.getCurrentPlan());

// プラン設定を確認
console.log(PlanManager.getPlanConfig());

// 使用状況を確認
console.log(PlanManager.checkDailyLimit());

// 使用回数を手動でインクリメント（テスト用）
PlanManager.recordUsage();

// 強制的に制限モーダルを表示（テスト用）
PlanManager.showUpgradeModal(30, 30, 'trainee_lite');
```

---

## 🎯 差別化の確認方法

### 同じ入力で4プランを比較

**入力:** "食事を手伝ってください"

**期待される応答:**

```
【trainee ライト】(30-40文字)
"はい。いま じゅんびする。ゆっくり たべて。"

【trainee スタンダード】(50-70文字)
"はい、わかりました。いま、ごはんの じゅんびを しますね。ゆっくり たべてください。"

【ssw スタンダード】(80-120文字)
"かしこまりました。ただいま、おしょくじの じゅんびを させていただきます。おせきに おすわりいただけますでしょうか。あたたかいうちに、ゆっくり おめしあがりください。"

【ssw プロフェッショナル】(120-180文字)
"しょうちいたしました。それでは、おしょくじの じゅんびを させていただきます。ほんじつの メニューは、さばの みそにと おんやさい サラダでございます。おせきに おすわりいただけますでしょうか。しせいを ととのえて、せもたれに もたれていただきますと、ごえんの リスクが へります。あたたかいうちに、ゆっくりと おめしあがりください。"
```

---

## ⚠️ トラブルシューティング

### 問題1: プランが反映されない

**原因:** `meta.plan`がAPIに送信されていない

**解決:**
```javascript
// index.htmlの送信処理を確認
const currentPlan = PlanManager.getCurrentPlan();
console.log('Sending plan:', currentPlan); // ← デバッグログ追加

// metaオブジェクトにplanが含まれているか確認
meta: {
  // ... 他のパラメータ
  plan: currentPlan // ← これが必須
}
```

### 問題2: 使用回数がリセットされない

**原因:** 日付判定のロジックエラー

**解決:**
```javascript
// ブラウザのローカルストレージをクリア
localStorage.clear();

// または、特定のキーだけ削除
const today = new Date().toISOString().split('T')[0];
localStorage.removeItem(`usage_trainee_lite_${today}`);
```

### 問題3: 応答が長すぎる/短すぎる

**原因:** プロンプトの`max_sentence_chars`が守られていない

**解決:**
```javascript
// chat-4tier.jsのプロンプトを確認
CRITICAL LENGTH CONSTRAINTS:
- Your AI response ("ai.hira") MUST be under ${planConfig.max_sentence_chars} characters

// より強い制約を追加
You MUST count characters before responding. If over limit, shorten it.
```

### 問題4: モーダルが表示されない

**原因:** plan-manager.jsが読み込まれていない

**解決:**
```html
<!-- index.htmlの<head>内で確認 -->
<script src="/plan-manager.js"></script>

<!-- または -->
<script>
console.log(typeof PlanManager); // "object"と表示されればOK
</script>
```

---

## 📈 次のステップ

### 今すぐできること（Day 1）
```
✅ chat-4tier.jsをデプロイ
✅ index-4tier.htmlをデプロイ
✅ plan-manager.jsを配置
✅ ローカルでテスト
```

### 今週中（Week 1）
```
□ Stripe商品作成（4プラン）
□ Webhookエンドポイント実装
□ 決済フロー統合
□ β版ユーザーテスト
```

### 来週（Week 2-3）
```
□ 法務ドキュメント作成
□ 利用規約・プライバシーポリシー
□ マーケティングページ追加
□ ソフトローンチ
```

---

## 💰 収益予測（再掲）

### 保守的シナリオ（月間46人）
```
trainee ライト: 20人 × ¥980 = ¥19,600
trainee スタンダード: 15人 × ¥1,680 = ¥25,200
ssw スタンダード: 8人 × ¥2,680 = ¥21,440
ssw プロフェッショナル: 3人 × ¥4,980 = ¥14,940
━━━━━━━━━━━━━━━━━━━━━━━━━
合計売上: ¥81,180
合計利益: ¥65,570（利益率: 80.8%）
```

---

## ✅ 完了チェックリスト

実装が完了したら、以下を確認:

```
□ chat-4tier.jsが本番デプロイ済み
□ index-4tier.htmlが本番デプロイ済み
□ plan-manager.jsが読み込み可能
□ 4プランすべてで動作確認済み
□ 使用回数制限が機能
□ アップグレードモーダルが表示
□ 応答の長さが各プランで異なる
□ フィードバックが各プランで異なる
□ コンソールにエラーがない
□ モバイルで動作確認済み
```

---

## 📞 サポート

実装中に問題があれば、以下の情報と共に連絡:
1. どのステップで問題が発生したか
2. エラーメッセージ（あれば）
3. ブラウザのコンソールログ
4. 期待する動作 vs 実際の動作

---

**実装時間: 約1-2時間**
**推奨: 今日から開始、今週中に完了**

次は Stripe決済統合へ進みましょう！
