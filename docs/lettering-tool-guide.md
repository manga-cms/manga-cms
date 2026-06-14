# 写植ツール 使い方ガイド

作家・編集者向けの操作ガイドです。技術仕様は
[lettering-tool-spec.md](lettering-tool-spec.md) を参照してください。

## 写植ツールとは

読書画面（overlay）で、セリフを焼き込まない「空フキダシ版」のページ画像の上に、
セリフテキストを HTML で重ねて表示します。写植ツールは、そのテキストを
フキダシに合わせて「改行・位置・サイズ」調整する機能です。原画（canonical
content）は変えず、表示の組版だけを整えます。

## いまできること / まだのこと

できること（現状の実装範囲）:

- 日本語（ja）のフキダシの写植を CMS で見たまま（WYSIWYG）編集
- 翻訳（en / zh-Hans / sv など）の Translation Pack Draft entry の写植を言語タブで編集
- 改行位置、文字の揃え、フォントサイズ・太さ・行間・字間、フィットモード
- 日本語の編集結果は公開 overlay にそのまま反映
- 翻訳の編集結果は Pack Draft に保存され、export/publish 後に公開 overlay に反映

まだのこと（今後の段階で対応）:

- 編集者の「承認待ち修正」・読者の「修正提案」

## 前提

1. **権限**: 写植の保存には `manage_rights`（作家／シリーズオーナー相当）が必要です。
   権限が無い場合は閲覧のみで、保存ボタンは表示されません。
2. **空フキダシ画像**: 対象 Episode の各 Page に、セリフを抜いた空フキダシ版画像
   （`ja-blank` などのバリアント）が用意されている必要があります。クリスタなどで
   テキストレイヤーを非表示にして書き出します。
3. **overlay の有効化**: 対象 Episode で overlay 表示が有効になっている必要があります
   （運用側の設定）。

## 使い方（CMS 写植モード）

1. CMS（`cms.manga-cms.com`）にログインします。
2. 対象作品 → Episode → **Lettering** を開きます。
   ルートは `/works/{seriesId}/episodes/{episodeId}/lettering` です。
3. 空フキダシ画像の上に、いまのテキストが重なって表示されます。これは公開 overlay と
   同じレンダラを使ったプレビューです。
4. 編集したいフキダシを選びます。
5. 右側のインスペクタで写植を編集します:
   - **改行（lines）**: フキダシ上で直接編集するか、右側のテキスト欄で行ごとに改行位置を
     指定します。フキダシ上では `Enter` で表示行を追加できます。半角スペースに頼らず、
     ここで明示的に改行します（半角スペースは文字としてそのまま残ります）。
   - **揃え（inline / block align）**: 行方向と行送り方向の揃え（始端／中央／終端）。
     縦書きは右上始端、横書きは左上始端が「始端（start）」です。
     フキダシ上の青い丸いハンドルをドラッグすると、選んだアンカーを基準に自由な XY
     オフセットを調整できます。位置は `offsetXPercent` / `offsetYPercent` として、
     フキダシ bbox に対する割合で保存されます。
   - **フォントサイズ / 太さ / 行間 / 字間**。
   - **フィットモード（fitMode）**:
     - `auto`: 自動で収まるよう調整（写植前の既定）
     - `shrink`: 指定サイズを基準にし、はみ出すときだけ縮小
     - `fixed`: 指定サイズで固定（はみ出しはフキダシ内スクロール）
6. プレビューで収まりと改行を確認します。
7. **保存**します。日本語（ja）は `manage_rights` があれば、その場で canonical に反映されます。
   翻訳タブでは、対応する Translation Pack Draft entry の `text_layout` / `text_style` に保存されます。
8. 公開 overlay（`read.manga-cms.com/works/.../episodes/.../overlay`）で最終確認します。

## 翻訳写植

翻訳写植は、公開済み Pack を直接編集しません。先に Translation Pack Draft に翻訳 entry を
作成し、その entry に対して写植だけを保存します。翻訳タブが表示されるのは、対象 Episode に
対応する Translation Pack Draft がある場合です。

1. 翻訳 import などで Translation Pack Draft entry を作成します。
2. 写植画面の言語タブ（例: `en`, `zh-Hans`, `sv`）を開きます。
3. 対応する Bubble entry があるフキダシだけ編集できます。entry が無い場合は、その旨が表示されます。
4. 保存すると、Draft entry の `text_layout` / `text_style` だけが更新されます。翻訳本文や Bubble ID は変わりません。
5. レビュー後、Pack Draft を export/publish すると、公開 overlay の `?lang=...` に反映されます。

## 手書きでの写植（上級・UI を使わない方法）

UI を使わず、`contents/` の `episode.json` の各 Bubble に `textLayout` / `textStyle` を
直接書くこともできます。

```json
{
  "bubbleId": "...",
  "textOriginal": "ここが新しい街か",
  "textLayout": { "lines": ["ここが", "新しい街か"] },
  "textStyle": { "fontSizePx": 28, "lineHeight": 1.3, "fitMode": "shrink" }
}
```

注意: CMS の通常の Episode 保存（写植ワークスペース以外の保存）は、写植データを上書きしません。
既存の写植は保持され、保存に含めた写植差分は無視されます。日本語写植は「写植モードの保存」か
「手書き JSON」のどちらかで入ります。翻訳写植は、通常の translation import ではなく、
Translation Pack Draft entry の写植保存か、レビュー済み Pack JSON への手書き追加で入ります。

## 制約・注意

- 原文（`textOriginal`）は写植では変わりません。写植は表示用の別データです。
- フキダシ枠（`bbox`）は写植では動かしません。枠の調整は構造編集側で行います。
- 翻訳写植は言語ごとに Pack Draft entry で別管理します。未publishのDraft写植は公開overlayには出ません。
- overlay は現在 `noindex`（検索非掲載）の実験運用です。

## 関連ドキュメント

- 技術仕様: [lettering-tool-spec.md](lettering-tool-spec.md)
- overlay の表示モデル: [docs/reader-text-layer-spec.md](reader-text-layer-spec.md)
