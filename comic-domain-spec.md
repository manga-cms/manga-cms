# comic-domain-spec.md

# Manga Domain Specification

## 1. この文書の役割

この文書は、Manga Infrastructure における **漫画コンテンツのドメインモデル** を定義する。

この文書が定義するもの:

- コンテンツ階層
- ID設計
- 共有単位
- Extension Pack の仕様
- URL 契約
- Viewer / API / DB の責務境界
- ロケールと配信モデルの基盤

この文書は以下の仕様の基礎となる。

- schema.prisma
- openapi.yaml
- ingestion pipeline
- rendering pipeline

---

# 2. コンテンツ階層

漫画コンテンツは以下の階層で構成される。

```
Series
 └── Episode
      └── Page
           └── Panel
                └── Bubble
```

| レベル | 説明 | 例 |
|--------|------|----|
| Series | 作品単位。タイトル、説明、状態を持つ | "Rain World" |
| Episode | 話単位。連載回に対応 | 第1話「雨の廃墟」 |
| Page | 見開き/単ページ。画像とサイズ情報を持つ | 1ページ目 (500×760px) |
| Panel | コマ。BoundingBox と reaction tags を持つ | コマ1 (0,0,500,400) |
| Bubble | 吹き出し。セリフ、話者、タイプを持つ | 「ここは…どこだ？」(speech) |

型定義は `packages/domain/src/types.ts` に集約される。

---

# 3. ID 設計

## 3.1 Canonical ID

コンテンツの正本 ID は **Git リポジトリ内のパス構造** から導出される。

```
{seriesId}/{episodeId}/p{pageNumber}/k{panelNumber}/f{bubbleNumber}
```

例: `rain-world/ep01/p001/k001/f001`

## 3.2 Database ID

DB レコードには `cuid()` で生成された一意 ID を使用する（`schema.prisma` 参照）。
Canonical ID は `canonicalRef` フィールドとして保存され、Git ↔ DB 間の突合に使用する。

## 3.3 Short ID

共有 URL や UI 表示用の短縮形式。

```
{pageNumber}-{panelNumber}-{bubbleNumber}
```

例: `1-1-1`

---

# 4. 共有単位 (Shareable Units)

ARCHITECTURE.md §4.2 に定義された、SNS/OGP 共有の最小単位。

| 単位 | 説明 | URL パターン |
|------|------|-------------|
| Quote | 吹き出し1つ | `/quote/{seriesId}/{episodeId}/{page}/{panel}/{bubble}` |
| Clip | コマ範囲 | `/clip/{seriesId}/{episodeId}/{page}/{panelStart}/{panelEnd}` |
| Reaction | タグ検索 | `/reaction/{tag}` |

これらは viewer 側で SSR レンダリングされ、OGP メタタグを含む。
API 側にも対応エンドポイントが存在する（`openapi.yaml` 参照）。

---

# 5. URL 契約

## 5.1 Viewer ルーティング

| パス | レンダリング | 説明 |
|------|-------------|------|
| `/` | Prerender | ホーム |
| `/works` | Prerender | 作品一覧 |
| `/works/{seriesId}` | Prerender | 作品詳細 |
| `/works/{seriesId}/episodes/{episodeId}` | SSR | エピソード読者（entitlement gating） |
| `/quote/{seriesId}/{episodeId}/{page}/{panel}/{bubble}` | SSR | 引用共有ページ |
| `/clip/{seriesId}/{episodeId}/{page}/{panelStart}/{panelEnd}` | SSR | クリップ共有ページ |
| `/reaction/{tag}` | SSR | リアクション検索 |

## 5.2 Reader 内フラグメント

エピソードページ内では、フラグメント識別子でページ位置を指定する。

```
/works/{seriesId}/episodes/{episodeId}#p{pageNumber}
```

共有ページからエピソードへのリンクにはこのフラグメントを含める。

## 5.3 API エンドポイント

| API パス | 認証 | 説明 |
|----------|------|------|
| `GET /series/{seriesId}/episodes/{episodeId}/pages/{pageNumber}` | Optional | Reader ページペイロード |
| `GET /deliver/{pageId}?lang=ja&token=…` | Token / Bearer | 透かし付き画像配信 |
| `GET /quotes/{seriesId}/{episodeId}/{page}/{panel}/{bubble}` | なし | Quote API |
| `GET /clips/{seriesId}/{episodeId}/{page}/{panelStart}/{panelEnd}` | なし | Clip API |
| `GET /reactions?tag={tag}` | なし | Reaction 検索 API |

---

# 6. 画像配信モデル

## 6.1 原則

画像は **origin URL を直接公開しない**。

配信フロー:
1. Reader API がページデータを返す。`images` フィールドには delivery URL が入る
2. Delivery URL: `/deliver/{pageId}?lang=ja&token={signed_token}`
3. Delivery endpoint が entitlement を検証し、watermark を注入して画像を返す

## 6.2 Watermark Seed

```
watermark_seed = HMAC(secret, entitlement_id + page_id + lang + session_bucket)
```

- 無料コンテンツ: entitlement_id なしの汎用シード
- 有料コンテンツ: ユーザー固有のシード
- 個人情報は埋め込まない（派生識別子のみ）

---

# 7. Extension Pack

Pack はコンテンツの上に被せる追加レイヤー。

| Pack Type | 用途 |
|-----------|------|
| TRANSLATION | 翻訳テキスト |
| FOOTNOTE | 注釈・解説 |
| COMMENTARY | コメンタリー |
| LEARNING | 学習教材 |
| ACCESSIBILITY | アクセシビリティ |

Pack はコンテンツとは独立にバージョニングされ、Proposal → Review → Merge のフローで公開される。

---

# 8. ロケール

デフォルトロケール: `ja`

ロケール対応の範囲:
- `<html lang>` 属性（viewer BaseLayout）
- ページ画像のロケールバリアント（`PageImageSet`）
- Pack のテキスト言語
- OGP メタタグ（`og:locale`）
- `hreflang` リンク

---

# 9. 責務境界

| レイヤー | 責務 | やらないこと |
|----------|------|-------------|
| **viewer** (Astro) | HTML レンダリング、ルーティング、OGP | 認証判定、画像処理、DB アクセス |
| **api** (Hono) | データ取得、entitlement 検証、delivery URL 生成、watermark 注入 | HTML レンダリング |
| **domain** (共有パッケージ) | 型定義、ビジネスルール定数 | 永続化、HTTP |
| **db** (Prisma) | スキーマ定義、マイグレーション、クライアント生成 | ビジネスロジック |
| **schemas** (Zod) | API リクエスト/レスポンスのバリデーション | 永続化、UI |

viewer は API の戻り値に含まれる delivery URL をそのまま `<img src>` に使う。
viewer 自身が画像の origin URL を知る必要はない。