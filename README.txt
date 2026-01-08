【配置】
- /index.html         : LP（トップ）
- /app/index.html     : アプリ本体
- /api/chat.js        : OpenAI呼び出しAPI（Vercel Serverless Function）
- /vercel.json        : ルーティングは最小（cleanUrlsのみ）

【Vercelに登録する環境変数】
- OPENAI_API_KEY : OpenAIのAPIキー

【よくある原因（/appでAPIのコードが表示される）】
- vercel.json の rewrites / routes で /app を /api/chat に飛ばしている
- /app/index.html が存在しない、または誤って api/chat.js の内容を入れてしまっている
→ まず GitHub の /app/index.html が "<!DOCTYPE html>" で始まるHTMLになっているか確認してください。
