# ingestion-spec.md

# Ingestion Specification

## 1. この文書の役割

この文書は、Manga Infrastructure における
**原稿取り込み（Ingestion）パイプライン**を定義する。

Ingestion の目的は、漫画原稿を単なる画像の集合としてではなく、
**Page / Panel / Bubble を持つ構造化データ**へ変換することである。

この文書が扱う範囲は以下である。

- 入力フォーマット
- 抽出パイプライン
- OCR / テキスト照合
- CMS確認フロー
- Git正本への反映
- DB索引への同期

LLM / VLM を組み込んだ draft 生成は任意の補助機能であり、
標準必須の取り込み経路ではない。公開 OSS では、OCR / LLM / VLM を
正本ではなく候補生成の補助として扱い、最終判断は CMS review で行う。

この文書は以下の仕様に依存する。

- `docs/api-contract.md`
- `docs/cms-ux-spec.md`
- `docs/oss-boundary.md`
- `docs/architecture/layer-boundary.md`
- `packages/domain/src/types.ts`
- `packages/schemas/src/content.ts`

---

## 2. Ingestion の基本方針

### 2.1 完全自動化を目標にしない

本システムは、100%の完全自動構造化を目指さない。

目標は、

**人間の確認コストを大きく下げること**

である。

つまり、Ingestion は以下の構造を前提とする。

1. 自動抽出
2. 信頼度判定
3. 人間による確認
4. 確定

### 2.2 Ground Truth の優先順位

抽出されたデータは以下の優先順位で扱う。

1. クリスタ由来のテキスト情報
2. PSD 等の中間形式から抽出したテキスト情報
3. OCR による抽出テキスト
4. 人手による修正・入力

OCR は補助情報であり、正本ではない。

### 2.3 上流ルールの活用

Ingestion の精度は、下流の解析だけでなく、
制作側のルール整備によっても向上する。

推奨する上流ルールの例:

- テキストレイヤー命名規則
- テキストレイヤーを専用フォルダにまとめる
- ページごとの書き出しルール
- 可能なら Bubble 対応IDを埋め込める運用

---

## 3. 入力モデル

### 3.1 必須入力

最低限必要な入力は以下。

- ページ画像
- ページ順序
- 作品 / 話数情報

### 3.2 推奨入力

精度向上のため、以下の中間入力を推奨する。

- PSD 書き出し
- テキスト書き出し（ストーリーエディター等）
- レイヤー一覧
- テキストレイヤー名
- 言語別レンダリング画像（ある場合）

### 3.3 入力フォーマットのレベル

Ingestion は、入力の充実度に応じて複数レベルを許容する。

#### Level 0: 画像のみ
- ページ画像のみ
- OCR と画像解析が主
- 最も確認コストが高い

#### Level 1: 画像 + テキスト書き出し
- プレーンテキストあり
- 文字列照合が可能
- OCR依存が減る

#### Level 2: 画像 + PSD
- テキストレイヤー情報を取得できる可能性
- 位置推定精度が上がる

#### Level 3: 画像 + PSD + 制作ルール準拠
- レイヤー命名規則あり
- 構造化が最も安定する

---

## 4. Ingestion の出力

Ingestion の最終出力は以下である。

### 4.1 Git正本用ドラフト
- `contents/{seriesId}/...`
- `packs/...`

に保存可能な JSON ドラフト

現在の公開OSSアーキテクチャでは、確定後の canonical editorial source of
truth は `contents/` と `packs/` である。DB は検索・CMS操作・Proposal対象
解決のための runtime index / operational state であり、漫画本文の正本では
ない。

### 4.2 DB索引用ドラフト
- Page / Panel / Bubble 参照
- Proposal対象
- CMS確認用の一時データ

### 4.3 確信度メタデータ
抽出された各要素について、信頼度を保持する。

例:
- panel detection confidence
- bubble text match confidence
- OCR confidence

---

## 5. パイプライン全体像

Ingestion は以下の段階に分かれる。

1. Upload / Import
2. Normalize
3. Panel Detection
4. Text Region Detection
5. OCR
6. Source Text Extraction
7. Matching
8. Draft JSON Generation
9. CMS Review
10. Confirm
11. Git Commit / Sync
12. DB Reindex

---

## 6. ステップ詳細

## 6.1 Upload / Import

入力ファイルを受け取る。

対象:
- ページ画像群
- PSD
- テキスト書き出し
- メタデータ

この時点で Job を作成し、同期APIでは処理しない。

### 出力
- ingestion job record
- 一時保存領域へのファイル配置

---

## 6.2 Normalize

入力を内部標準形式へ変換する。

処理例:
- 画像ファイル名の正規化
- ページ番号の推定
- PSD / text export の整形
- ファイル形式チェック

### 出力
- normalized input bundle

---

## 6.3 Panel Detection

ページ画像からコマ候補を抽出する。

### 手法候補
- 輪郭抽出
- Hough線変換
- 領域分割
- MLベースのコマ検出

### 注意
Panel 検出は高精度候補抽出を目指すが、
完全自動確定は前提としない。

### 出力
- panel candidate list
- bbox
- confidence

---

## 6.4 Text Region Detection

ページ画像からテキスト領域候補を検出する。

### 対象
- セリフ
- モノローグ
- ナレーション
- 擬音候補

### 出力
- text region list
- bbox
- confidence

---

## 6.5 OCR

検出した text region に対して OCR を実行する。

### OCR の位置づけ
OCR は正本ではなく補助情報である。

### 用途
- 文字列照合
- 位置推定補助
- 欠落発見

### 出力
- OCR text
- confidence
- region reference

---

## 6.6 Source Text Extraction

画像外のテキスト情報を抽出する。

候補:
- クリスタ由来のテキスト
- PSDテキストレイヤー
- ストーリーエディター出力
- レイヤー名

### 出力
- source text candidates
- optional position hints
- optional layer order
- optional layer metadata

---

## 6.7 Matching

抽出された source text と OCR / region / panel を突き合わせる。

### 利用する信号
- 文字列類似度
- 位置近傍
- 読み順
- レイヤー順
- panel 内包判定
- bubble候補との空間関係

### Matching の目標
- text -> region
- region -> panel
- source text -> bubble candidate

### 出力
- matched bubble candidates
- unmatched source texts
- unmatched OCR regions
- confidence

---

## 6.8 Spatial Containment

Panel と Bubble の階層を決めるために、
空間的包含関係を優先的に使う。

### 基本ルール
- text region の中心が panel bbox 内にあれば、その panel に属する候補とする
- 複数 panel にかかる場合は confidence を下げる
- panel 外テキストは narration / note 候補として扱う

### 効果
文字列類似度だけに頼らず、
構造的に panel_id を安定化できる。

---

## 6.9 Draft JSON Generation

抽出・照合結果から Git正本向けドラフトを生成する。

対象:
- `contents/{seriesId}/series.json`
- `contents/{seriesId}/{episodeId}/episode.json`
- 必要に応じた `packs/` 配下の Pack JSON

この時点ではまだ「ドラフト」であり、正本ではない。

### 出力
- draft content tree
- extraction report
- confidence report

---

## 7. CMS Review フロー

### 7.1 目的

自動抽出結果を、人間が最短で確認・修正できるようにする。

### 7.2 基本UI

最低限必要な画面要素:

- 左: ページ画像
- 画像上: panel / bubble bbox のオーバーレイ
- 右: 抽出候補一覧
- 下またはサイド: 詳細編集

### 7.3 MVPの確認機能

MVPでは以下を優先する。

- bbox の表示
- 候補の採用 / 却下
- テキスト修正
- panel / bubble の紐付け確認
- short_id 確認

### 7.4 段階導入する機能

高度な編集機能は後から入れる。

後続候補:
- bbox リサイズ
- bbox 移動
- 結合
- 分割
- bubble 並び順変更

---

## 8. 確信度とレビュー優先順位

CMS は全要素を同じ重さで見せない。

confidence に応じて優先順位をつける。

### 例
- high: 自動採用候補
- medium: 要確認
- low: 要手動修正

これにより、確認コストを下げる。

---

## 9. 確定後の処理

レビュー担当者が確定すると、以下を行う。

1. JSON ドラフトを確定
2. `contents/` / `packs/` の canonical source に書き出す
3. DB索引を更新
4. 再レンダリングが必要ならジョブを発行する

---

## 10. Git への反映

### 10.1 正本反映方針

確定したデータは `contents/` へ反映する。

Starter:
- ローカルファイルへ直接反映

Production:
- Gitブランチ作成
- commit
- PR / merge または自動同期

### 10.2 Git で管理する理由
- 差分追跡
- ロールバック
- 監査性
- Pull Request ベースのレビュー

---

## 11. DB への反映

DB は運用用索引として更新する。

対象:
- SeriesRef
- EpisodeRef
- PageRef
- PanelRef
- BubbleRef
- PackRef（必要に応じて）

DB は正本ではなく、
検索・CMS操作・Proposal対象解決のための索引である。

---

## 12. 非同期処理モデル

### 12.1 同期APIでやらないこと
以下は同期リクエストで実行しない。

- OCR
- panel detection
- matching
- draft generation
- language image rendering
- DB full reindex

### 12.2 Job モデル
Ingestion は Job として実行する。

状態例:
- queued
- running
- waiting_review
- confirmed
- failed

### 12.3 実行環境
Starter:
- ローカルワーカー
- 別プロセス
- タスクランナー

Production:
- Queue / Worker
- Background job system
- CI連携

---

## 13. 例外ケース

以下は明示的に扱う必要がある。

- 手書き文字
- 擬音のみの領域
- フキダシ外モノローグ
- 枠外注釈
- 曲線配置テキスト
- panel 境界が曖昧な演出
- OCR 不一致
- source text はあるが位置不明

これらは low confidence として人手確認へ回す。

---

## 14. 制作ルールとの接続

精度向上のため、制作ガイドラインを用意する。

例:
- テキストレイヤー名のルール
- テキスト専用フォルダ
- PSD書き出し運用
- 画像書き出し規約
- ページ番号規約

Ingestion は解析アルゴリズムだけでなく、
制作ルールとの協調で強化する。

---

## 15. このパイプラインの本質

このパイプラインの本質は、
原稿から完璧な構造を自動で得ることではない。

本質は、

- 上流の制作情報を活かし
- 画像解析で不足を埋め
- 人が最小コストで確認し
- Git正本として定着させる

ことである。

つまりこれは

**原稿を物語データへ変換するための半自動編集パイプライン**
である。
