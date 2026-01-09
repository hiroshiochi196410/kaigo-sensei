分割生成パッチ（B: JP + suggested + feedback） 使い方
==================================================

目的:
  体感速度を上げるため、AI応答を2段階に分割します。
    Step1: 日本語のみ（ai_reply_jp / suggested_reply_jp / feedback_jp）
    Step2: 変換のみ（romaji / Indonesian）

ファイル構成:
  api/chat.js   …差し替え用（stage=1/2 分岐）
  index.html    …分割生成デモ（あなたのUIに組み込み用の参考）

1) 置き換え（必須）
  あなたのリポジトリの /api/chat.js を、このパッチの api/chat.js で置き換えてください。

2) フロント側の組み込み（必須）
  既存の index.html / app.js などで、送信処理を以下の流れにします。

  (1) stage=1 を呼ぶ → 返ってきた jp を即表示
  (2) stage=2 を呼ぶ → romaji/id を後から追記表示

3) 環境変数（既存のままでOK）
  OPENAI_API_KEY  …必須
  OPENAI_MODEL    …任意（未設定なら gpt-4o-mini）

4) 既存UIへ最短で組み込むコツ
  - “結果表示欄”を4つに分ける:
      ai_reply_jp / feedback_jp / suggested_reply_jp / (addon)
  - addon は Step2 成功時だけ表示

5) よくあるつまずき
  - /api/chat にPOSTできていない → Vercelで /api/chat.js が認識されているか確認
  - Step2で meta.jp が空 → stage=1 の json をそのまま meta.jp に渡す

---
このREADMEは、あなたの現行UIに合わせてさらにピンポイントに調整できます。
