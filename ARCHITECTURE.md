# ARCHITECTURE.md

# Manga Infrastructure Architecture

## 1. この文書の目的

この文書は、Manga Infrastructure の**アーキテクチャ設計**を定義する。

README.md はプロジェクトの目的や魅力を説明するための文書であり、
この文書はそれを受けて、以下を明確にするためのものである。

- どのようなドメインモデルを採用するか
- どの責務をどの層に置くか
- 何を正本（source of truth）とするか
- 共有・翻訳・課金・防御をどう接続するか
- 実装仕様（Prisma / OpenAPI / DB schema / UI）へどう分解するか

この文書は**Product Spec と Implementation Spec の中間層**に位置する。

---

## 2. システムの核心

本システムは、漫画を単なる静的画像ではなく、**構造化された物語データ**として扱う。

従来の漫画配信は以下のような構造を持つ。

- ページ画像を配信する
- 読者はページ単位で読む
- 共有は主にスクリーンショットに依存する
- 翻訳や注釈は非公式に行われやすい

本システムでは漫画を以下のように扱う。

- ページ、コマ、フキダシに安定した ID を付与する
- セリフを URL で共有できる
- 翻訳、脚注、作者コメントを外付け Pack として追加できる
- コミュニティが翻訳や注釈に参加できる
- 課金や特典解放を権利モデルで一元管理する
- 配信画像に個別識別を埋め込み、不正転載を抑止する

つまり、漫画を

**静的なページ画像**
から
**共有・翻訳・注釈・権利制御が可能な知的メディア**
へ変換することを目指す。

---

## 3. 設計原則

### 3.1 原作不変（Immutable Content）

原作データは不変とする。

翻訳、脚注、コメント、学習補助などの追加情報はすべて
**Extension Pack** として保持する。

これにより以下を実現する。

- 原作破壊の防止
- コミュニティ編集の安全性
- 監査と差分管理の容易さ
- 派生機能の追加容易性

### 3.2 安定 ID（Stable IDs）

共有・翻訳・注釈・引用・権利制御のすべては、安定した ID を基盤にする。

最小の意味単位は Bubble（フキダシ）とするが、
Page / Panel / Bubble / Clip のすべてが参照可能である必要がある。

### 3.3 表は Wiki、裏は Git

参加者向けの編集体験は、非エンジニアでも使いやすい UI とする。

一方で、正本管理・履歴・差分・監査は GitHub などの Git ベース管理に寄せる。

つまり、

- 表: Wiki / 投稿UI / レビュー画面
- 裏: Git / structured data / build pipeline

という二層構造を採用する。

### 3.4 共有単位を小さくする

SNS や引用文化と相性が良いのは、小さい単位のコンテンツである。

本システムでは以下の共有単位を持つ。

- Page
- Panel
- Quote（Bubble）
- Clip（複数 Panel）
- Reaction Panel

### 3.5 課金より権利を中心に設計する

決済は外部サービスに委譲可能であり、システムの中核ではない。

本システムではまず
**誰が何を読めるか**
を Entitlement で定義し、
購入、翻訳貢献報酬、プロモ、管理者付与などを
同じ権利モデルで扱う。

### 3.6 読書体験を最優先する

構造化、共有、翻訳、注釈、権利制御は重要だが、Reader の最優先は
**普通の漫画ビューアーとして速く、気持ちよく読めること**である。

通常読書時には以下を守る。

- 画像を主役にする
- 構造情報、bbox、ID、注釈導線を常時表示しない
- 共有、翻訳、脚注、作者コメントは読書を中断しない形で出す
- 初回読書ではネタバレ性のある情報を隠す
- 追加情報はタップ、モード切替、読了後導線から開く

構造機能は読者に押し付けず、必要な人が必要な場面で使えるようにする。

### 3.7 公式キュレーションを先に置く

Quote / Clip / Reaction は拡散力が高い一方で、著作権、ネタバレ、文脈破壊、
作品の品位管理の問題を起こしやすい。

そのため初期段階では、自由なユーザー生成共有よりも、
公式が選んだ Quote / Clip / Reaction を優先する。

ユーザー自由 Clip、外部 Embed、公開可能なファン投稿は、Share Policy、
Spoiler Policy、削除・無効化機構、権利者レビューが整ってから開放する。

---

## 4. ドメインモデル

### 4.1 コンテンツ階層

漫画コンテンツの基本階層は以下とする。

- Series
- Episode
- Page
- Panel
- Bubble

#### Series
作品全体。

#### Episode
話数単位。

#### Page
ページ単位の表示・配信単位。

#### Panel
コマ単位。Clip や Reaction の基本単位。

#### Bubble
フキダシ / セリフ単位。Quote、翻訳、脚注の基本単位。

### 4.2 Shareable Units

共有可能な単位は以下。

- Page
- Panel
- Bubble（Quote）
- Clip（Panel range）
- Reaction Panel（タグ付けされた Panel）

### 4.3 Extension Packs

原作以外の追加情報を Pack として管理する。

代表例:

- Translation Pack
- Footnote Pack
- Commentary Pack
- Learning Pack
- Accessibility Pack

Pack は原作データを変更しない。

### 4.4 Entitlement

権利付与の中心概念。

代表的な付与理由:

- purchase
- contributor_reward
- promo
- admin_grant
- subscription

対象:

- series
- volume
- episode
- pack
- premium_bundle

### 4.5 Proposal / Review

コミュニティ編集は直接正本を書き換えない。

まず Proposal を作成し、Review を経て、承認後に正本へ反映する。

### 4.6 Reading Mode

Reader は Pack を直接並べるのではなく、読者や編集者が理解しやすい
モードとして機能を出し分ける。

代表的な reading mode:

- `normal`: 通常読書。構造情報は隠す。
- `study`: コマ、フキダシ、ID、注釈を確認する。
- `translation_review`: 原文、翻訳、文字数、収まり、提案導線を確認する。
- `commentary`: 作者・編集者コメントを読む。
- `accessibility`: 読み上げや補助説明を使う。

MVPでは `normal` と `study` を優先する。

### 4.7 Display Preset

内部的には複数 Pack を適用できるが、UI では Pack をそのまま読者に選ばせない。
代わりに display preset として提示する。

例:

- `default`: 普通に読む
- `translated`: 指定言語で読む
- `annotated`: 注釈つきで読む
- `author_commentary`: 作者コメントつきで読む
- `learning`: 語学学習する
- `review`: 翻訳・構造を確認する

これにより Pack が増えても Reader UI の複雑化を抑える。

### 4.8 Official Curation

公式が選定した共有・導入地点をドメインとして持つ。

代表例:

- official quotes
- official clips
- official reactions
- recommended entry points
- spoiler-free promotion links

これはスクリーンショット文化を公式共有文化へ置き換えるための中心機能である。

### 4.9 Share Policy

すべての共有可能単位は、共有可否と条件を持つ。

例:

- page share allowed
- panel share allowed
- bubble share allowed
- clip share allowed
- max clip panels
- requires entitlement
- official only
- expires or can be disabled

特に Clip は強力だが危険な共有単位なので、MVPでは公式Clipを優先し、
ユーザー自由Clipは公開前レビューまたは端末内保存から始める。

### 4.10 Spoiler Policy

Quote / Clip / Reaction / Commentary / Footnote にはネタバレレベルを持たせる。

代表値:

- `none`: ネタバレなし
- `light`: 軽いネタバレ
- `major`: 重大なネタバレ
- `ending`: 結末ネタバレ

用途:

- SNSカードで警告する
- 未読話のClipやReactionを隠す
- 読了後だけ作者コメントや伏線メモを出す
- 公式布教リンクを `none` に限定する

### 4.11 Edition

漫画は公開後にページ順、セリフ、版、レイアウトが変わる。

代表的な edition:

- `web_serialized`
- `volume`
- `revised`
- `color`
- `vertical_scroll`
- `international`

内部IDは edition をまたいで安定させるか、明示的な対応表を持つ。
ページ番号や表示上の参照は変わり得るため、内部IDと表示IDを分離する。

---

## 5. ID と URL 設計

### 5.1 Internal ID

内部IDは画像座標やページ番号から生成しない。

ページ差し替え、ページ追加、単行本修正、縦読み版、海外版などで表示位置が
変わっても同じ対象を追跡できるように、意味を持ちすぎない安定IDを使う。

例:

- `pg_01HX...`
- `pnl_01HX...`
- `bub_01HX...`

### 5.2 Display Ref

人間向けにはページ・コマ・フキダシ番号を使った表示IDを持つ。

例:

- `p5`
- `p5-2`
- `p5-2-1`

Display Ref は UI 表示や編集確認には便利だが、内部の永続参照としては扱わない。

### 5.3 URL Alias

共有用URLは、内部IDと表示IDの両方を解決できる alias として扱う。

古い表示IDのURLは、edition やページ差し替え後も可能な範囲で新しい内部IDへ
リダイレクトまたは解決する。

### 5.4 URL 共有単位

#### Page
Reader内移動:
`/{series}/{episode}#p{page}`

例:
`/rain-world/3#p5`

共有・OGP用:
`/{series}/{episode}/page/{page_ref}`

#### Panel
Reader内移動:
`/{series}/{episode}#p{page}-{panel}`

例:
`/rain-world/3#p5-2`

共有・OGP用:
`/{series}/{episode}/panel/{panel_ref}`

#### Bubble / Quote
Reader内移動:
`/{series}/{episode}#p{page}-{panel}-{bubble}`

例:
`/rain-world/3#p5-2-1`

共有・OGP用:
`/quote/{quote_id}` または `/{series}/{episode}/quote/{bubble_ref}`

#### Clip
Reader内移動:
`/{series}/{episode}#p{page}-{panel_start}..{panel_end}`

例:
`/rain-world/3#p5-2..4`

共有・OGP用:
`/clip/{clip_id}` または `/{series}/{episode}/clip/{clip_ref}`

Fragment URL は Reader 内ジャンプには有効だが、SNS の OGP 生成ではサーバーに
送られない。したがって、共有の正本URLはサーバーが解決できる path または
query URL とし、fragment は読書位置復元に使う。

---

## 6. Reader アーキテクチャ

### 6.1 Reader の責務

Reader は単なる画像表示ではなく、以下の責務を持つ。

- ページ画像表示
- ハイライト対象の解決
- Quote / Clip / Reaction の共有
- 翻訳切替
- 脚注表示
- 作者コメント表示
- Pack の ON/OFF
- entitlement に基づく閲覧制御

### 6.2 表示方式

初期実装では、翻訳切替は**画像自体を言語別に切り替える方式**を優先する。

理由:

- 見た目が安定する
- 吹き出し内レイアウトの崩れを避けられる
- モバイルで堅い
- レンダリング結果をそのままレビューできる

ただし内部データは引き続き構造化されている。

つまり、

- 内部: source + packs
- 表示: rendered image per language

という構造を採る。

### 6.3 ハイライトと詳細表示

Reader は Bubble / Panel / Clip を選択できる。

選択時には以下を出せる。

- 原文
- 翻訳
- 脚注
- 作者コメント
- 共有リンク
- 提案導線

### 6.4 Mode Separation

Reader は通常読書モードと構造表示モードを分離する。

#### Normal Mode

通常読書モードでは以下を優先する。

- ページ画像を主役にする
- bbox、Bubble ID、Panel ID を表示しない
- 初回読書で脚注、作者コメント、翻訳比較を自動表示しない
- タップ時のみ最小限の共有・翻訳・注釈導線を出す

#### Study Mode

構造表示モードでは以下を出す。

- コマ枠
- フキダシ枠
- Bubble / Panel の表示ID
- 原文、翻訳、脚注、作者コメントのサイドパネル
- Proposal 導線

#### Translation Review Mode

翻訳確認では以下を出す。

- 原文
- 翻訳文
- 文字数警告
- 改行候補
- レンダリング済み画像との比較
- 修正 Proposal 作成導線

### 6.5 First Read / Reread

初回読書と再読では表示すべき情報が違う。

初回読書:

- ネタバレ防止
- 注釈、作者コメント、伏線メモは控えめ
- 読書速度を優先

再読:

- コメント
- 脚注
- 翻訳比較
- 公式Quote / Clip / Reaction
- キャラ別セリフ一覧
- 伏線メモ

MVPでは localStorage に読書進捗を持ち、読了後に追加導線を出す。
アカウント連携は後段でよい。

### 6.6 読了後カード

各話の最後に読了後カードを表示できるようにする。

例:

- 次の話を読む
- この話の公式Quoteを見る
- 公式Clipを見る
- 公式Reactionを見る
- 作者コメントを読む
- 翻訳に協力する

読了後カードは、通常読書を妨げずに Quote / Clip / Commentary / Translation へ
接続するための導線である。

---

## 7. 共有アーキテクチャ

### 7.1 Share Policy

共有可能な単位は、それぞれ共有可否、ネタバレレベル、権利条件、公式/非公式の
状態を持つ。

最低限持つべき属性:

- `share_allowed`
- `share_kind`
- `spoiler_level`
- `requires_entitlement`
- `official`
- `max_panel_count`
- `disabled_at`
- `disabled_reason`

### 7.2 Quote

Bubble 単位の共有。

主な用途:

- 名言共有
- セリフ単位引用
- 翻訳比較
- 脚注付き共有

Quote は公式Quoteを優先する。将来的には共有回数、作者指定、キャラ別一覧から
名セリフ一覧を生成できる。

### 7.3 Clip

複数コマをまとめた共有。

主な用途:

- ギャグの流れ
- 会話シーン
- 名場面
- オチ

Clip は文脈付き共有に強いが、権利・ネタバレ・引用範囲の問題が大きい。
MVPでは公式Clipを優先する。

ユーザー自由Clipは以下の条件が整ってから開放する。

- 最大コマ数制限
- spoiler_level
- 有料話の共有制限
- 非公開保存
- 承認制公開
- disable / takedown 機構

### 7.4 Reaction Panel

感情の強いコマを共有する仕組み。

主な用途:

- SNS のリアクション画像
- 返信用の公式 Reaction
- 感情タグによる検索

タグ例:

- surprised
- crying
- angry
- awkward
- thinking

Reaction Panel には感情タグだけでなく、SNSでの使い道タグも持てる。

使い道タグ例:

- reply
- thanks
- sorry
- congrats
- agree
- reject
- comeback
- encouragement

MVPでは公式Reactionのみを対象にする。

### 7.5 Promotion Link

布教用の共有導線を持つ。

例:

- 1話冒頭から読む
- キャラの初登場から読む
- ネタバレなし紹介カードを共有する
- 公式Clipから本編へ戻る

Promotion Link は spoiler_level `none` の公式共有単位から構成する。

### 7.6 OGP

SNS共有ではURLよりOGP画像が強い。

対象:

- Page OGP
- Quote OGP
- Clip OGP
- Reaction OGP

MVPでは Page OGP を優先し、次に公式Quote / 公式Clip / 公式ReactionのOGPを
追加する。大量の動的OGP生成は後段でよい。

### 7.7 Embed

Quote / Clip / Reaction は外部サイトに埋め込める必要がある。

対象:

- ブログ
- レビュー記事
- 考察記事
- SNS

これにより、スクリーンショット文化を
**公式埋め込み文化**
へ置き換える。

ただし Embed は権利、課金、無効化、ネタバレ制御が難しいため、MVPでは後回しにする。

---

## 8. Pack アーキテクチャ

### 8.1 Pack の責務

Pack は原作に対する追加情報のレイヤーである。

Pack は以下の特徴を持つ。

- 原作を変更しない
- 単独に version 管理できる
- コミュニティ編集可能
- 複数 Pack を同時に適用可能

### 8.2 Pack の代表例

#### Translation Pack
Bubble 単位の翻訳。

#### Footnote Pack
文化・歴史・言語の注釈。

#### Commentary Pack
作者・編集者コメント。

#### Learning Pack
語学学習用拡張。

#### Accessibility Pack
読み上げや補助情報。

### 8.3 Pack の適用

Reader は言語・設定・権利に応じて Pack を読み込む。

例:

- `lang=en`
- `packs=footnotes-en,commentary-author`

ただし読者向けUIでは Pack を直接並べず、Reading Mode と Display Preset に
変換して提示する。

---

## 9. コミュニティアーキテクチャ

### 9.1 参加モデル

非エンジニアでも参加できることが前提。

参加者ができること:

- 翻訳提案
- 脚注提案
- 誤字修正指摘
- ニュアンス改善提案
- コメント投稿

### 9.2 ワークフロー

基本フロー:

1. 提案
2. レビュー
3. 承認
4. 正本反映
5. 配信反映

### 9.3 GitHub との関係

コミュニティ参加 UI は直接 Git を触らなくてよい。

ただし承認済みデータの正本管理は GitHub 側に持つ。

つまり、

- 投稿とレビュー = 専用 UI
- 永続化と履歴 = GitHub

である。

### 9.4 クレジットと貢献

提案が採用された場合、Contribution Ledger に記録する。

将来的には以下に使う。

- contributor credit
- reward entitlement
- payout calculation

ただし、MVPでは Community Proposal UI を一般開放しない。
初期は招待制翻訳者、誤字指摘、管理者レビューなど範囲を絞る。
翻訳貢献報酬は労務・契約・税務に近づくため、Contribution Ledger は持っても
実報酬は後段に回す。

---

## 10. 支払い・権利アーキテクチャ

### 10.1 決済方針

初期フェーズでは決済を自前実装しない。

外部決済サービスを使う。

候補:

- Gumroad
- Stripe

現時点では Gumroad を優先する。

理由:

- 初期実装が軽い
- 国際販売しやすい
- コード発行が容易
- 税務負担を軽減できる

### 10.2 ユーザー体験

理想の体験は

- お金を払ったらすぐ読める
- コードは裏側で処理される
- ただしメールにはバックアップコードが送られる

である。

### 10.3 Entitlement 中心設計

購入は目的ではなく、Entitlement を付与するためのトリガーである。

流れ:

1. 外部決済
2. purchase_code / purchase_id 受領
3. サイト側で検証
4. entitlement 発行
5. 対象話数 / Pack 解放

### 10.4 翻訳貢献報酬との統合

Entitlement は購入だけでなく、翻訳貢献報酬にも使う。

例:

- 購入者: volume_access
- 翻訳者: contributor_reward
- 管理者: admin_grant

同一モデルで扱う。

---

## 11. 防御アーキテクチャ

### 11.1 目的

完全防止ではなく、以下を狙う。

- 不正転載の抑止
- 学習用スクショ収集のコスト増
- 流出時の追跡補助
- 心理的抵抗の形成

### 11.2 画像個別化

有料・特典閲覧では、権利由来の識別情報から画像に微差分を入れる。

埋め込むのは個人情報ではなく、派生した識別子である。

例:

- watermark_seed = HMAC(secret, entitlement_id + page_id + lang + session_bucket)

### 11.3 告知

詳細を言いすぎず、以下程度に留める。

- 不正共有防止のため、配信画像には発行履歴と照合可能な情報が含まれる場合がある
- 個人情報そのものを画像に埋め込むものではない
- 不正共有は禁止
- 発行履歴と照合される場合がある

### 11.4 Entitlement との接続

ここが重要である。

- purchase
- contributor_reward
- promo
- admin_grant

すべて同じ権利モデルから watermark が派生する。

---

## 12. 制作ツール連携

### 12.1 目的

翻訳 Pack を制作ツールへ流し込みやすくする。

### 12.2 基本方針

CLIP STUDIO などの制作ツールに対して、翻訳テキストを構造化データから再流し込み可能にする。

必要な要素:

- bubble_id
- bbox
- source_text
- translated_text

### 12.3 方式

初期段階では、

- translation JSON export
- スクリプトによるレイヤー更新
- 半自動インポート

を想定する。

---

## 13. GitHub / データ管理アーキテクチャ

### 13.1 GitHub に置くもの

- source
- packs
- docs
- glossary
- style guide

### 13.2 DB に置くもの

- proposals
- comments
- contribution ledger
- entitlement
- purchase records
- session / watermark events

### 13.3 原則

- コンテンツ正本は Git
- 運用状態は DB

---

## 14. ドキュメント分割方針

このプロジェクトでは文書を以下に分ける。

### README.md
人間向けの概要説明。
魅力・背景・主機能。

### ARCHITECTURE.md
本書。ドメインモデルと責務分離。

### comic-domain-spec.md
コンテンツモデル、ID、Pack の仕様。

### entitlement-spec.md
権利、購入コード、解放ルール。

### schema.prisma
DB 実装定義。

### openapi.yaml
API 実装定義。

つまり本書は、実装仕様を直接書くのではなく、
そこへ派生させるための土台である。

---

## 15. ロードマップ

### Phase 1
- normal reading mode
- study mode
- Page / Panel / Bubble URL
- path-based canonical share URLs for OGP
- selected target highlighting
- basic share link generation
- page OGP
- language-switched image rendering
- basic translation pack

### Phase 2
- official quotes
- official clips
- official reactions
- read-complete card
- localStorage reading progress
- spoiler policy
- share policy
- character quote list
- favorite panel / quote local save
- footnote packs
- commentary packs

### Phase 3
- translation review mode
- translation comparison view
- restricted community proposal UI
- moderator review flow
- GitHub sync
- entitlement system
- Gumroad integration
- watermark delivery
- embed cards

### Phase 4
- user-generated public clips
- pack marketplace
- contributor rewards
- accessibility reading
- multi-site federation
- open manga infrastructure

---

## 16. このシステムの本質

このシステムは単なる漫画ビューアでも、単なる翻訳ツールでもない。

本質は以下である。

- 漫画を URL で参照できるようにする
- 漫画を引用可能にする
- 漫画をコミュニティで翻訳・注釈可能にする
- 漫画を権利制御可能にする
- 漫画を知的メディア基盤にする

要するに、これは

**漫画のためのインフラ**
である。
