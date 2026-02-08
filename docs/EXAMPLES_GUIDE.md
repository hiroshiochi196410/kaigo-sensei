# 例文データ（examples.json）運用ガイド（Phase1 / P2）

このアプリの「例文を入れる」ボタンは、各バリアント（trainee / ssw）の `examples.json` を読み込みます。

- trainee: `app/trainee/examples.json`
- ssw: `app/ssw/examples.json`

## データ構造（schema_version 2.2）

```json
{
  "schema_version": "2.2",
  "scene_labels": {
    "bath": {"jp":"入浴","id":"Mandi"},
    "...":  {"jp":"...","id":"..."}
  },
  "personas": [
    {"key":"user_calm","label":"利用者：穏やか","label_id":"Pengguna: Tenang"},
    ...
  ],
  "scenes": {
    "bath": [
      {"key":"greet","label":"あいさつ","label_id":"salam"},
      ...
    ],
    ...
  },
  "examples": {
    "bath": {
      "user_calm": {
        "greet": [
          {"jp":"...","romaji":"...","id":"...","level":"beginner"}
        ]
      }
    }
  }
}
```

### level の意味
- `beginner` / `intermediate` / `advanced`
- 画面の「レベル」選択と連動します（該当が無い場合は他レベルから選びます）。

## 追加したシーン（P2）
- bath / meal / toilet / night / complaint（既存）
- handover（申し送り）
- emergency（急変）
- fall（転倒）

## 例文の追加手順（最短）
1. 追加したいバリアント（trainee or ssw）の `examples.json` を開く
2. `scenes` にカテゴリが無ければ、カテゴリを追加
3. `examples.<scene>.<persona>.<category>` の配列に 1 件追加
4. Vercel にデプロイ

### 例文の書き方（おすすめ）
- `jp` は **ひらがな中心**（数字は可）
- 短く、現場でそのまま言える形
- `id` はインドネシア語（直訳より自然さ優先）

## UI/実装側の補足（P2）
- 例文が無い組み合わせでも、同じシーン内から自動フォールバックして必ず 1 つ選ぶようにしています。
  - 例：選択 persona の該当カテゴリが空でも `user_calm` や別カテゴリから拾います。
