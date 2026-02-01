ミスター用：カテゴリ例文 × 分割生成 統合パッチ
======================================

このZIPは、以下を「そのまま差し替えで動く」形にまとめたものです。
- examples.json : bath/meal/toilet/night/complaint をカテゴリ化（persona×カテゴリ×複数例文）
- index.html    : 例文投入 → /api/chat Stage1 → （自動）Stage2 の統合UI
- api/chat.js   : Stage1（JP）/ Stage2（ローマ字+インドネシア語）対応API Route（OpenAI）

配置（重要）
-----------
1) リポジトリ直下：
   - index.html
   - examples.json

2) API Route（Next.js / Vercel想定）：
   - /api/chat.js

環境変数
-------
- OPENAI_API_KEY を Vercel の Environment Variables に設定

動作確認
-------
1) 画面で scene / persona / カテゴリ を選ぶ
2) 「例文を入れる」→ 文章が入る（押すたびにローテ）
3) 「送信」→ Stage1結果が出る
4) チェックがONなら自動でStage2が出る（OFFなら「Stage2だけ実行」）

よくある詰まり
-------------
- examples.json が古いと例文が1つ固定に見えます：必ずZIPの examples.json に置き換え
- Vercel反映後、ブラウザは Ctrl+F5 で強制リロード推奨
