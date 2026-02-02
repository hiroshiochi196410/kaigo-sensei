# ローンチ準備ロードマップ（差別化実装後）

## 🎯 前提条件

✅ trainee/ssw の差別化実装が完了
✅ 動作確認済み
✅ コスト最適化実装済み

---

## 📅 3週間ローンチスケジュール

---

## Week 1: 技術完成 + 法務整備

### Day 1-2: Stripe完全実装

#### タスク1: Stripe商品・価格設定

```bash
# Stripe Dashboard での作業

=== trainee（技能実習生向け） ===

商品1: 介護AI - trainee ベーシック
価格: ¥1,280/月（税込）
Price ID: price_trainee_basic_1280
説明: 50回/日、基礎シナリオ

商品2: 介護AI - trainee スタンダード
価格: ¥1,980/月（税込）
Price ID: price_trainee_standard_1980
説明: 100回/日、全シナリオ

=== ssw（特定技能向け） ===

商品3: 介護AI - ssw スタンダード
価格: ¥2,480/月（税込）
Price ID: price_ssw_standard_2480
説明: 100回/日、高度シナリオ

商品4: 介護AI - ssw プロフェッショナル
価格: ¥3,980/月（税込）
Price ID: price_ssw_professional_3980
説明: 無制限、全機能
```

---

#### タスク2: Webhook設定

```bash
# 1. Webhook URL設定
https://your-domain.vercel.app/api/stripe/webhook

# 2. 監視イベント
✅ checkout.session.completed
✅ customer.subscription.created
✅ customer.subscription.updated
✅ customer.subscription.deleted
✅ invoice.payment_succeeded
✅ invoice.payment_failed

# 3. Signing Secret取得
whsec_xxxxxxxxxxxxx
```

---

#### タスク3: 環境変数設定

```bash
# Vercel Dashboard → Settings → Environment Variables

STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# trainee
STRIPE_PRICE_ID_TRAINEE_BASIC=price_trainee_basic_1280
STRIPE_PRICE_ID_TRAINEE_STANDARD=price_trainee_standard_1980

# ssw
STRIPE_PRICE_ID_SSW_STANDARD=price_ssw_standard_2480
STRIPE_PRICE_ID_SSW_PROFESSIONAL=price_ssw_professional_3980
```

---

#### タスク4: プラン選択UI実装

**trainee/index.html に追加:**

```html
<!-- プラン選択モーダル -->
<div id="planModal" class="lock" style="display:none">
  <div class="panel">
    <h2>プランを選択</h2>
    <p class="small">技能実習生向けプラン</p>
    
    <div class="planChoice">
      <!-- ベーシック -->
      <label class="planOpt">
        <input type="radio" name="plan" value="basic" checked>
        <div>
          <div class="planName">ベーシック</div>
          <div class="planPrice">¥1,280/月</div>
          <div class="small">50回/日・基礎シナリオ</div>
        </div>
      </label>
      
      <!-- スタンダード -->
      <label class="planOpt">
        <input type="radio" name="plan" value="standard">
        <div>
          <div class="planName">スタンダード</div>
          <div class="planPrice">¥1,980/月</div>
          <div class="small">100回/日・全シナリオ</div>
        </div>
      </label>
    </div>
    
    <button class="btn primary" onclick="startCheckout()">
      購読を開始
    </button>
  </div>
</div>

<script>
async function startCheckout() {
  const plan = document.querySelector('input[name="plan"]:checked').value;
  
  const priceIds = {
    basic: CFG.stripe_price_id_basic,
    standard: CFG.stripe_price_id_standard
  };
  
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId: priceIds[plan],
      variant: VARIANT
    })
  });
  
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  }
}
</script>
```

---

### Day 3-4: 使用回数制限実装

#### タスク5: 日次制限ロジック

```javascript
// trainee/index.html に追加

const PLAN_LIMITS = {
  trainee: {
    basic: 50,
    standard: 100
  },
  ssw: {
    standard: 100,
    professional: 999999
  }
};

function checkDailyLimit() {
  const today = new Date().toISOString().split('T')[0];
  const usage = ls.get(`usage_${VARIANT}_${today}`, { count: 0, date: today });
  
  // 日付が変わったらリセット
  if (usage.date !== today) {
    usage.count = 0;
    usage.date = today;
    ls.set(`usage_${VARIANT}_${today}`, usage);
  }
  
  const plan = ls.get('subscription_plan', 'basic');
  const limit = PLAN_LIMITS[VARIANT][plan];
  
  if (usage.count >= limit) {
    showUpgradeModal(usage.count, limit);
    return false;
  }
  
  return true;
}

function incrementUsage() {
  const today = new Date().toISOString().split('T')[0];
  const usage = ls.get(`usage_${VARIANT}_${today}`, { count: 0, date: today });
  usage.count += 1;
  ls.set(`usage_${VARIANT}_${today}`, usage);
  
  updateUsageDisplay(usage.count);
}

function updateUsageDisplay(count) {
  const plan = ls.get('subscription_plan', 'basic');
  const limit = PLAN_LIMITS[VARIANT][plan];
  const remaining = limit - count;
  
  $("usageInfo").textContent = `今日の残り: ${remaining}/${limit}`;
}

function showUpgradeModal(used, limit) {
  const modal = document.createElement('div');
  modal.className = 'lock';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="panel">
      <h2>今日の利用上限に達しました</h2>
      <p>今日は${used}回利用しました（上限: ${limit}回/日）</p>
      <p class="small">明日0時にリセットされます。</p>
      
      <button class="btn primary" onclick="location.href='/pricing'">
        上位プランを見る
      </button>
      <button class="btn" onclick="this.closest('.lock').remove()">
        閉じる
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}
```

---

### Day 5-7: 法務ドキュメント作成

#### タスク6: 利用規約（必須）

**docs/terms.html**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>利用規約 | 介護ロールプレイAI</title>
</head>
<body>
  <h1>利用規約</h1>
  
  <h2>第1条（適用）</h2>
  <p>本規約は、介護ロールプレイAI（以下「本サービス」）の利用に関する条件を定めます。</p>
  
  <h2>第2条（サービス内容）</h2>
  <p>本サービスは、AI技術を活用した介護日本語学習支援サービスです。</p>
  
  <h2>第3条（利用料金）</h2>
  <h3>trainee（技能実習生向け）</h3>
  <ul>
    <li>ベーシック: 1,280円/月（税込）- 50回/日</li>
    <li>スタンダード: 1,980円/月（税込）- 100回/日</li>
  </ul>
  
  <h3>ssw（特定技能向け）</h3>
  <ul>
    <li>スタンダード: 2,480円/月（税込）- 100回/日</li>
    <li>プロフェッショナル: 3,980円/月（税込）- 無制限</li>
  </ul>
  
  <h2>第4条（支払方法）</h2>
  <p>クレジットカード（Stripe経由）による月額課金</p>
  
  <h2>第5条（解約・返金）</h2>
  <p>いつでも解約可能。日割り返金なし。次回更新日まで利用可能。</p>
  
  <h2>第6条（禁止事項）</h2>
  <ul>
    <li>アカウントの不正利用</li>
    <li>本サービスの妨害行為</li>
    <li>第三者への転売・譲渡</li>
  </ul>
  
  <h2>第7条（免責事項）</h2>
  <p>本サービスは学習支援ツールであり、医療行為・介護資格取得を保証するものではありません。</p>
  
  <h2>第8条（個人情報）</h2>
  <p>個人情報の取り扱いについては、別途プライバシーポリシーに定めます。</p>
  
  <h2>第9条（準拠法・管轄）</h2>
  <p>日本法に準拠。東京地方裁判所を専属的合意管轄裁判所とします。</p>
  
  <p>制定日: 2026年2月1日</p>
  <p>運営者: [あなたの名前/会社名]</p>
  <p>お問い合わせ: support@kaigo-ai.com</p>
</body>
</html>
```

---

#### タスク7: プライバシーポリシー（必須）

**docs/privacy.html**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>プライバシーポリシー | 介護ロールプレイAI</title>
</head>
<body>
  <h1>プライバシーポリシー</h1>
  
  <h2>1. 収集する情報</h2>
  <h3>1.1 ユーザーが提供する情報</h3>
  <ul>
    <li>メールアドレス</li>
    <li>支払情報（Stripeが管理）</li>
    <li>入力した会話内容</li>
  </ul>
  
  <h3>1.2 自動収集される情報</h3>
  <ul>
    <li>IPアドレス</li>
    <li>ブラウザ情報</li>
    <li>利用状況（アクセス日時、利用回数）</li>
  </ul>
  
  <h2>2. 情報の利用目的</h2>
  <ul>
    <li>サービス提供</li>
    <li>決済処理</li>
    <li>サービス改善</li>
    <li>カスタマーサポート</li>
  </ul>
  
  <h2>3. 第三者提供</h2>
  <p>以下のサービスと情報を共有します：</p>
  <ul>
    <li><strong>OpenAI</strong>: AI会話生成のため</li>
    <li><strong>Google Cloud</strong>: 音声合成のため</li>
    <li><strong>Stripe</strong>: 決済処理のため</li>
    <li><strong>Vercel</strong>: ホスティングのため</li>
  </ul>
  
  <h2>4. Cookie</h2>
  <p>ローカルストレージを使用して、学習履歴を保存します。</p>
  
  <h2>5. データの保存期間</h2>
  <ul>
    <li>会話履歴: ブラウザのローカルストレージに保存（削除可能）</li>
    <li>決済情報: Stripeが管理</li>
    <li>アカウント情報: 解約後3ヶ月で削除</li>
  </ul>
  
  <h2>6. セキュリティ</h2>
  <p>HTTPS暗号化通信、API認証により情報を保護します。</p>
  
  <h2>7. お問い合わせ</h2>
  <p>個人情報に関するお問い合わせ: privacy@kaigo-ai.com</p>
  
  <h2>8. 特定商取引法に基づく表記</h2>
  <ul>
    <li>運営者: [名前/会社名]</li>
    <li>所在地: [住所]</li>
    <li>連絡先: support@kaigo-ai.com</li>
    <li>販売価格: 各プランページ参照</li>
    <li>支払方法: クレジットカード（Stripe）</li>
    <li>解約: マイページからいつでも可能</li>
  </ul>
  
  <p>制定日: 2026年2月1日</p>
</body>
</html>
```

---

## Week 2: テスト + 改善

### Day 8-10: 内部テスト

#### タスク8: 機能テストチェックリスト

**trainee:**
```
□ トライアル（5回）が機能
□ プラン選択UI表示
□ Stripe決済フロー
  □ ベーシック選択 → 正しい価格
  □ スタンダード選択 → 正しい価格
  □ 決済成功 → リダイレクト
  □ サブスク確認API動作
□ 日次使用回数制限
  □ 50回でストップ（ベーシック）
  □ 100回でストップ（スタンダード）
  □ 0時リセット確認
□ AI会話品質
  □ 短い文章（10-15単語）
  □ 簡単な語彙（N5-N4）
  □ ローマ字デフォルト表示
  □ インドネシア語表示
  □ 励ましのフィードバック
□ 音声再生（iPhone/Android）
□ レスポンシブデザイン
```

**ssw:**
```
□ トライアル（3回）が機能
□ プラン選択UI表示
  □ スタンダード
  □ プロフェッショナル
□ Stripe決済フロー
□ 日次使用回数制限
  □ 100回でストップ（スタンダード）
  □ 無制限（プロフェッショナル）
□ AI会話品質
  □ 自然な長さ（15-25単語）
  □ 専門語彙（N4-N3）
  □ ひらがなのみ表示
  □ インドネシア語非表示
  □ プロフェッショナルなフィードバック
□ 高度シナリオ表示
```

---

### Day 11-14: β版テスト

#### タスク9: テストユーザー募集

**目標: 10人（trainee: 7人、ssw: 3人）**

```
募集方法:
□ 日本語学校に依頼
□ 送り出し機関に依頼
□ SNS（Facebook/Instagram）
□ 知人の紹介
```

---

#### タスク10: フィードバック収集

**アンケート（Google Forms）:**

```
基本情報:
1. 使用したvariant（trainee/ssw）
2. 日本語レベル（N5/N4/N3/N2）
3. 日本滞在期間

評価（1-5）:
4. 使いやすさ
5. AI会話の自然さ
6. 音声の聞き取りやすさ
7. 3段表示の有用性
8. 価格の妥当性

自由記述:
9. 良かった点
10. 改善してほしい点
11. 追加してほしい機能
```

---

## Week 3: 最終調整 + ローンチ

### Day 15-17: 改善実装

#### タスク11: β版フィードバック反映

```
優先度:
🔴 Critical: 即座に修正
🟡 High: Day 15-16で対応
🟢 Medium: Day 17で対応
⚪ Low: ローンチ後対応
```

---

#### タスク12: UI/UX微調整

```
□ ボタンサイズ調整（モバイル）
□ フォントサイズ最適化
□ エラーメッセージ改善
□ ローディング表示追加
□ オンボーディング実装（簡易版）
```

---

### Day 18-19: マーケティング準備

#### タスク13: ランディングページ

**index.html 改善:**

```html
<section class="hero">
  <h1>24時間いつでも<br>介護日本語を練習</h1>
  <p>AI相手に何度でも会話練習。ひらがな・ローマ字・インドネシア語の3段表示。</p>
  
  <div class="cta">
    <button class="btn primary" onclick="location.href='/app/trainee/'">
      技能実習生向け（無料お試し5回）
    </button>
    <button class="btn" onclick="location.href='/app/ssw/'">
      特定技能向け（無料お試し3回）
    </button>
  </div>
</section>

<section id="features">
  <h2>特徴</h2>
  <div class="grid">
    <div class="card">
      <h3>🤖 AIで会話練習</h3>
      <p>利用者・家族役のAIと実践的な会話</p>
    </div>
    <div class="card">
      <h3>🗣️ 高品質音声</h3>
      <p>正しい発音を何度でも聞ける</p>
    </div>
    <div class="card">
      <h3>🌏 3言語対応</h3>
      <p>ひらがな・ローマ字・インドネシア語</p>
    </div>
  </div>
</section>

<section id="pricing">
  <h2>料金プラン</h2>
  <!-- trainee/ssw 別の料金表 -->
</section>
```

---

#### タスク14: SNS設定

```
□ Facebook ページ
  - プロフィール画像
  - カバー画像
  - 説明文（日本語・インドネシア語）

□ Instagram アカウント
  - プロフィール
  - ハイライト
  - 投稿3件準備

□ 使い方動画（3分）
  - 日本語ナレーション
  - インドネシア語字幕
```

---

### Day 20-21: 最終確認 + ソフトローンチ

#### タスク15: 本番環境最終チェック

```
□ 環境変数すべて設定
□ Stripe Price ID 正しい
□ Webhook 動作確認
□ SSL証明書
□ ドメイン設定
□ OGP設定
□ Google Analytics設定
```

---

#### タスク16: ソフトローンチ

**Day 20（金曜）:**
```
□ β版ユーザーに正式版案内
□ 知人・友人に紹介
□ SNS投稿（限定公開）
```

**Day 21（土曜）:**
```
□ Facebook/Instagram 広告開始（テスト）
  予算: ¥500/日
  ターゲット: インドネシア 20-35歳
  
□ 初日目標:
  - 訪問者: 50人
  - トライアル利用: 10人
  - 有料転換: 1人
```

---

## 📊 KPI設定

### Week 1 目標

```
訪問者: 100人
トライアル: 30人
有料転換: 3人（10%）
MRR: ¥5,000-10,000
```

### Month 1 目標

```
訪問者: 500人
トライアル: 150人
有料転換: 30人（20%）
MRR: ¥50,000
```

---

## ✅ ローンチ準備チェックリスト

### 技術

```
□ trainee/ssw 差別化実装
□ Stripe完全実装
□ 使用回数制限
□ エラーハンドリング
□ モバイル対応
□ パフォーマンス最適化
```

### 法務

```
□ 利用規約
□ プライバシーポリシー
□ 特定商取引法表記
□ フッターリンク
```

### マーケティング

```
□ ランディングページ
□ SNSアカウント
□ 使い方動画
□ FAQ
```

### 運用

```
□ お問い合わせ対応体制
□ バグ報告フォーム
□ サポートメールアドレス
□ 監視・アラート設定
```

---

## 🚀 ローンチ判定基準

以下すべてクリアでローンチ可能:

```
✅ trainee/ssw の明確な差別化
✅ Stripe決済フロー完全動作
✅ 使用回数制限動作
✅ 法務ドキュメント公開
✅ β版テスト5人以上
✅ Critical バグゼロ
✅ モバイル完全動作
```

---

## 📞 サポート体制

ローンチ後の対応:

```
Week 1-2: 
- 毎日ログ確認
- エラー即座対応
- ユーザーフィードバック収集

Week 3-4:
- 週次レビュー
- 機能改善
- マーケティング最適化
```

---

**実装時間: 3週間（21日）**
**ローンチ目標日: Day 21**

次のステップ: 差別化実装ファイルを確認して、実装を開始しますか？
