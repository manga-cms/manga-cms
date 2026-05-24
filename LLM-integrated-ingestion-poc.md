# LLM-integrated Ingestion PoC

## 1. この文書の位置づけ

この文書は、`ingestion-spec.md` の companion document です。

`ingestion-spec.md` は本番の ingestion 方針を定義し、この文書は
**LLM を組み込んだ draft 生成 PoC をどう切るか**
を定義します。

PoC の目的は、漫画原稿の構造化コストを下げることです。
完全自動化は目標にしません。目標は次の 2 つです。

- 人手確認前の draft JSON を自動生成する
- 1 ページあたりの確認時間を実測で下げる

重要なのは、LLM が返す構造化 JSON は
「構文的に正しい」ことと「意味的に正しい」ことが別だという点です。
したがって、この PoC でも **最終検証は常にアプリ側で行う** 前提にします。

## 2. PoC の成功条件

PoC の成功条件は次です。

- panel と bubble の下書きが review 可能な粒度で出る
- OCR と source text の対応付けが、人手ゼロ入力より速い
- CMS 側での修正量が現実的な範囲に収まる

失敗条件も明確にします。

- draft の質が低く、作り直した方が速い
- 失敗ページ率が高く、運用が安定しない
- LLM 呼び出しコストが確認時間短縮に見合わない

## 3. 基本戦略

PoC では、LLM を単独で使いません。
以下のハイブリッド構成にします。

1. 画像入力
2. panel 候補抽出
3. text region 候補抽出
4. OCR
5. クリスタ / PSD / テキスト書き出し抽出
6. LLM による名寄せ・曖昧性解消
7. draft JSON 生成
8. CMS review
9. `contents/` への confirm

つまり LLM の主な役割は次です。

- bbox 候補の補助生成
- OCR と source text の対応付け
- panel / bubble への曖昧な割り当て
- review 用 JSON への整形

## 4. 入力

### 4.1 必須

- ページ画像一式

### 4.2 推奨

- クリスタ由来のテキスト書き出し
- PSD 書き出し
- ページ順メタデータ

### 4.3 補助

- レイヤー名
- テキストレイヤー順
- 作品固有の命名規則

### 4.4 優先順位

1. クリスタ由来テキスト
2. PSD テキスト
3. OCR
4. 人手修正

OCR は ground truth ではなく補助情報です。

## 5. Gemini に期待する役割

最初の provider は `GeminiProvider` でよいですが、PoC の責務は
`Gemini 固有実装` ではなく `LLM-assisted ingestion` の検証です。

PoC では 2 種類の仕事をさせます。

### A. Vision extraction

- panel candidate の bbox
- bubble candidate の bbox
- text region の bbox
- region label の推定
  - `speech`
  - `narration`
  - `thought`
  - `sfx`
  - `unknown`

### B. Alignment / reasoning

- OCR テキストと source text の対応付け
- bubble 候補への ID 仮割当
- panel 内包関係の解釈
- confidence 付き draft の生成

## 6. 現在のリポジトリとの整合

ここは PoC 文書で明示すべきです。

このリポジトリの confirm 対象は
`packages/domain/src/ingestion-types.ts` の `DraftPayload`
であり、そこには `confidence` や `source` をそのまま保存する欄はありません。

したがって PoC の出力は 2 層に分けます。

1. **LLM intermediate artifacts**
   - candidate bbox
   - OCR/source text alignment
   - confidence
   - source type
   - unknown 判定
2. **confirm 前の canonical draft**
   - 現在の `DraftPayload` に落とし込める形

重要なのは、
**confidence や source provenance は `contents/` 正本ではなく ingestion job 側の review metadata に持つ**
ことです。

## 7. PoC の最小出力

PoC では、まず 1 ページ単位の intermediate draft を作ります。

### 7.1 panel candidates

```json
{
  "page_id": "ep01-p001",
  "panels": [
    {
      "candidate_id": "ep01-p001-k001",
      "bbox": { "x": 0, "y": 0, "width": 600, "height": 800 },
      "confidence": 0.86
    }
  ]
}
```

### 7.2 bubble candidates

```json
{
  "page_id": "ep01-p001",
  "bubbles": [
    {
      "candidate_id": "ep01-p001-k001-f001",
      "panel_candidate_id": "ep01-p001-k001",
      "bbox": { "x": 120, "y": 90, "width": 220, "height": 100 },
      "text_original_candidate": "今日は雨だね",
      "text_source": "clip_text_export",
      "ocr_text": "今日は雨だね",
      "match_confidence": 0.93,
      "classification": "speech"
    }
  ]
}
```

### 7.3 confirm 前の canonical draft

最終的に CMS confirm へ渡す時点では、現行の `DraftPayload` に合わせて
次の形へ変換します。

```json
{
  "seriesId": "rain-world",
  "seriesTitle": "Rain World",
  "episodeId": "ep01",
  "episodeNumber": 1,
  "episodeTitle": "雨の廃墟",
  "pages": [
    {
      "pageNumber": 1,
      "imagePath": "pages/p01.jpg",
      "width": 1600,
      "height": 2400,
      "panels": [
        {
          "panelNumber": 1,
          "bbox": { "x": 0, "y": 0, "width": 600, "height": 800 },
          "reactionTags": [],
          "bubbles": [
            {
              "bubbleNumber": 1,
              "bubbleType": "speech",
              "textOriginal": "今日は雨だね"
            }
          ]
        }
      ]
    }
  ]
}
```

`confidence` や `source` は別 artifact として job に残します。

## 8. LLM 呼び出し設計

### 8.1 Stage A: 候補抽出

入力:

- ページ画像

出力:

- panel candidates
- bubble/text-region candidates

ここでは厳密確定ではなく **候補列挙** をさせます。

### 8.2 Stage B: 名寄せ

入力:

- 候補 bbox
- OCR 結果
- クリスタ由来テキスト一覧
- PSD テキスト一覧

出力:

- `bubble_id` 仮割当
- `text_original` 候補
- `panel_id` 割当
- confidence

### 8.3 Stage C: draft JSON 化

入力:

- Stage A/B の結果

出力:

- review 用 intermediate artifacts
- `DraftPayload` 相当の canonical draft

## 9. Schema を必ず使う

PoC では少なくとも次を schema 化します。

- panel candidate
- bubble candidate
- alignment result
- canonical `DraftPayload`

実装場所は `packages/schemas` に寄せるのが自然です。
PoC 用に `packages/schemas/src/llm-ingestion.ts` を切る方針でよいです。

LLM レスポンスは、structured output であっても必ずアプリ側で再検証します。

## 10. Job モデル

PoC の処理系は同期 API に載せません。

Job ベースにします。

1. upload
2. job create
3. normalize
4. OCR
5. LLM stage A
6. LLM stage B
7. canonical draft
8. CMS review
9. confirm

現在の `IngestionJobStatus` に合わせると、PoC の最低限の状態遷移は次です。

- `queued`
- `draft`
- `waiting_review`
- `confirmed`
- `failed`
- `canceled`

必要なら内部ログ上で stage 名を細かく持ちますが、
public な job status は増やしすぎない方がよいです。

## 11. Provider 抽象

最初の実装は Gemini でよいですが、唯一経路にしません。

```ts
interface IngestionLLMProvider {
  detectRegions(input: PageInput): Promise<RegionDraft[]>
  alignText(input: AlignmentInput): Promise<AlignmentDraft[]>
  buildDraft(input: DraftInput): Promise<PageDraft>
}
```

PoC の最初の実装は `GeminiProvider` でよいですが、
将来の差し替えを見越して API 境界を切っておきます。

## 12. CMS 側の PoC UI

PoC では豪華な bbox editor は不要です。
必要なのは次です。

- ページ画像表示
- 自動抽出 bbox overlay
- 候補一覧
- source text / OCR / chosen text の比較
- 採用 / 却下
- 最低限の text 修正
- 保存

つまり、review UI の最小版で十分です。

## 13. 成功指標

PoC で測るべき指標は次です。

### 精度系

- panel candidate recall
- bubble text alignment accuracy
- OCR と source text の一致率
- manual correction rate

### 作業コスト系

- 1 ページあたりの確認時間
- 1 話あたりの構造化時間
- 人がゼロから入力する場合との差

### 運用系

- 失敗ページ率
- 再試行率
- LLM 呼び出しコスト / 1 ページ

PoC の評価は「正答率」だけでなく、
**何分短縮できたか** を主指標にします。

## 14. 期待値の置き方

PoC では次のように考えます。

- bbox 候補はそこそこ当たればよい
- bubble text の完全一致を無理に目指さない
- 人がすぐ直せる draft が出れば成功
- 擬音・手書き・ルビは `unknown` / low confidence に逃がしてよい

成功条件は、

**自動生成が完璧であることではなく、人手レビューが明確に速くなること**

です。

## 15. 最初から難しい領域

最初から難しいものは明示し、PoC では low confidence 扱いでよいです。

- 擬音
- 手書き文字
- ルビ
- フキダシ外モノローグ
- 曲線配置テキスト
- panel 境界が曖昧な演出
- 装飾文字
- 変形フキダシ

## 16. PoC の範囲

まずやる範囲:

- 1 作品
- 1 話
- 3 から 5 ページ
- 横書き中心でも可
- 擬音は後回し
- source text があるケースを優先

まだやらない:

- 全ページ batch
- 商用課金との接続
- watermark との統合
- 高度な bbox 編集
- 完全自動 publish

## 17. 結論条件

PoC は次のどれかを満たせば前進です。

### 成功

- 人手確認時間が明確に減る
- bubble 対応付けの大半が draft で埋まる
- CMS 修正が現実的な量に収まる

### 部分成功

- panel / text region 抽出は有効
- ただし alignment は弱い
- それでも review UI の改善余地が見える

### 失敗

- draft の質が低すぎて確認より作り直しが速い
- 呼び出しコストが高すぎる
- 安定性が低い

## 18. ひとことで言うと

この PoC の本質は、

**LLM に最終正解を作らせることではなく、漫画原稿を review 可能な構造化 draft に変換させること**

です。
