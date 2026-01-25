AIGA（介護ロールプレイAI）ファイル配置

推奨フォルダ構成（リポジトリ直下）:
/
  index.html
  config.json
  examples.json
  vercel.json
  .env.local          ← Vercelの環境変数でもOK（例は .env.example 参照）
  /api
    chat.js
    create-checkout-session.js
    verify-session.js

使い方:
1) Vercel Project の Environment Variables に以下を設定
   - OPENAI_API_KEY
   - OPENAI_MODEL (例: gpt-4o-mini)
   - STRIPE_SECRET_KEY（Stripe利用する場合）
   - STRIPE_PRICE_ID_TRAINEE / STRIPE_PRICE_ID_SSW（サブスクPrice ID）
   - SITE_URL（あれば）
2) デプロイ後、以下URLでアクセス
   - /   （trainee）
   - /app/ssw  （ssw想定。表示上のvariantがsswになる）
3) 画面左でシーン等を選び、例文→送信で会話開始
   - Ctrl+Enter でも送信できます
4) お試し回数を超えると解除画面（Stripe or 解除コード）が出ます
