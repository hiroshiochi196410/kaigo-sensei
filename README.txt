kaigo-sensei 文例修正パッチ

目的:
- 「一口ずつ」などが「いっこくづつ」に変換される問題を回避するため、文例の日本語を最初からひらがな表記に修正しました。

差し替え対象:
- kaigo-sensei-main/app/trainee/examples.json
- kaigo-sensei-main/app/ssw/examples.json
- kaigo-sensei-main/examples.json

やり方:
1) GitHubの該当ファイルを開く
2) Upload / Add file で、このZIPの同じパスに上書き
3) Vercelが自動デプロイ → 端末は「強制リロード」(PC: Ctrl+Shift+R / iPhone: 共有→『再読み込み』 or キャッシュ削除)

修正内容(代表):
- 一口ずついきますね。準備できたら教えてください。
  → ひとくちずついきますね。じゅんびできたらおしえてください。
