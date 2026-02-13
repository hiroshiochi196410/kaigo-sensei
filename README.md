# kaigo-sensei Phase2 B 改善パッケージ（差し替え用 ZIP）

このZIPは、管理簿で指定されている **B実装（trainee/ssw両方差替え）** の必達条件を、落ちにくい実装でまとめた「安全版テンプレ」です。

## このパッケージで満たすもの
- ✅ trainee側でシーンが表示されない原因になりやすい **存在しないID参照 → JS停止** を防止（safe on()）
- ✅ config.json / examples.json の **2段階フォールバック読み込み**（相対→絶対→デフォルト）
- ✅ **解約/プラン管理ボタンを全プランで常時表示**
- ✅ **長文（急変/転倒/申し送り）は 5 unit 固定**（ボタン押下→次回送信コスト=5→送信後1に復帰）
- ✅ TTS用テキストの **（ ）内を読み上げない** ルールを厳密化（全角/半角対応）

## 使い方（まず試す）
1. このZIPを展開して、Vercel/静的ホスティングにそのまま置くと、`/trainee/` と `/ssw/` で動作します。
2. 既存リポジトリに組み込む場合は、次をコピーしてください：
   - `shared/`（共通ロジック）
   - `trainee/` と `ssw/`（入口の index.html と設定JSON）

## 重要：APIエンドポイントについて
このテンプレは次を想定しています（既存と違う場合は shared/app-main.js の URL を合わせてください）：
- 会話API: `POST /api/chat`  → `{"replyText":"JP\n\nROMAJI\n\nID"}` を返す想定
- サブスク状態: `GET /api/subscription-status` → `{"status":"active","active":true,"cancel_at_period_end":false,"current_period_end":1700000000,"portal_url":"..."}` 等
- ポータル起動: `POST /api/customer-portal` → `{"url":"..."}`

※上記が違っても、UI停止しないように「失敗時の表示」を入れています。

## ファイル構成
- `shared/core.js` : safe on(), JSONフォールバック, TTS括弧除去
- `shared/subscription.js` : 解約ボタン常時表示＋状態表示
- `shared/app-main.js` : アプリ本体（trainee/ssw共通）
- `trainee/*` / `ssw/*` : 入口と設定

## 次にやると良い（ミスター向け）
- 既存の `index.html` / `app.js` がある場合は、まず `shared/` の関数群だけ移植して「落ちない化」を最優先に。
- API URLが異なる場合は `shared/app-main.js` の `API` 定数を合わせる。

（生成日: 2026-02-13 JST）
