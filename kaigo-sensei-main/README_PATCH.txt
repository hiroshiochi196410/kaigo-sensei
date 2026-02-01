# kaigo-sensei Google TTS 적용 패치

このパッチは **ブラウザ内蔵TTS（speechSynthesis）をやめて**
**Google Cloud Text-to-SpeechでMP3を生成→Audio再生**に置き換えます。
さらに **IndexedDBキャッシュ**で2回目以降を高速化します。

## 1) 置き換えるファイル
- api/tts.js（新規）
- app/trainee/index.html（置き換え）
- app/ssw/index.html（置き換え）

## 2) Vercel 環境変数
Settings → Environment Variables に追加
- GOOGLE_TTS_API_KEY = （Google CloudのAPIキー）

※ すでに GOOGLE_CLOUD_API_KEY を使っている場合は、そのままでも動くようにしてあります。

## 3) 動作確認（ここが重要）
1. ブラウザで /app/trainee/ を開く
2. DevTools → Network を開く（Fetch/XHRでもOK）
3. 文章の右端の ▶ をクリック
4. Networkに **/api/tts** が出て、Status 200 になればOK  
   - Response 헤더: Content-Type: audio/mpeg
5. 音が出ない場合：
   - Console にエラーが出ていないか見る
   - /api/tts のレスポンスが 500/502 なら「環境変数」か「Google側の有効化」が原因

## 4) よくある原因
- ルート（/）の index.html を直していて、/app/trainee/index.html が古いまま
- Vercelに環境変数を入れたが、再デプロイしていない
- ブラウザキャッシュ（強制リロード：Ctrl+F5）
