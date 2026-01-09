カテゴリ例文：多シーン拡張パッチ（ZIP）
================================

追加・更新:
- examples.json : bath/meal/toilet/night/complaint をカテゴリ化し、ボタンでローテーションできる構造へ
- index.html    : 多シーン対応の動作確認デモ（本番UIへ移植可）

構造:
DB.examples[scene][persona][category] = [{jp, romaji, id}, ...]  // 複数入れてローテーション

最短反映:
1) リポジトリ直下の examples.json を置き換え
2) 動作確認したい場合 index.html も一旦このZIP版に置き換え
3) Vercelデプロイ後、scene/カテゴリ/ persona を切り替えて「例文を入れる」連打で変化を確認

次:
- 本番の「分割生成」UIへ、この構造をそのまま統合（例文→送信→Step1/2表示）
