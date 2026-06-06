# entitlement-spec.md

# Entitlement Domain Specification

## 1. この文書の役割

この文書は Manga Infrastructure における
**閲覧権・報酬・配信識別のドメインモデル**を定義する。

この仕様は次の機能の基盤となる。

- 有料作品の閲覧
- 翻訳者などへの閲覧権付与
- プロモーション配布
- 管理者付与
- ウォーターマーク生成
- 不正転載追跡

本システムでは **購入そのものではなく Entitlement（権利）を中心に設計する。**

---

# 2. Entitlement の概念

Entitlement は

**ユーザーが特定コンテンツにアクセスできる権利**

を表す。

権利の発生源に関わらず
すべて同一のモデルで管理する。

代表例

- 購入
- 翻訳貢献
- プロモーション
- 管理者付与

---

# 3. Entitlement モデル

基本構造

entitlement
id
user_id
target_type
target_id
source
created_at
expires_at

---

## 3.1 target_type

対象コンテンツ

series
episode
volume
pack
bundle

---

## 3.2 source

権利発生理由

purchase
contributor_reward
promo
admin_grant
subscription

---

# 4. Purchase フロー

外部決済サービスを利用する。

候補

- Gumroad
- Stripe

---

## 4.1 決済フロー

ユーザー
↓
外部決済
↓
Webhook
↓
purchase_record 作成
↓
entitlement 発行

---

## 4.2 purchase_record

purchase_record
id
provider
provider_purchase_id
product_id
created_at

provider

gumroad
stripe

---

# 5. 購入コード

ユーザーに発行されるコード。

目的

- 閲覧権確認
- コード共有時の追跡
- ウォーターマーク生成の seed

---

## 5.1 code_record

code_record
id
purchase_id
code
created_at

---

## 5.2 コードの特徴

コードは

- URLトークン
- セッション生成
- entitlement確認

に使う。

ユーザーは通常コード入力を意識しない。

---

# 6. 閲覧フロー

ユーザー
↓
作品アクセス
↓
entitlement確認
↓
閲覧許可
↓
画像生成

---

# 7. Watermark モデル

画像配信時に識別情報を埋め込む。

目的

- 不正転載の抑止
- 流出時の追跡
- AI学習用スクショのコスト増

---

## 7.1 重要原則

画像に

**個人情報を直接埋め込まない**

埋め込むのは

**派生識別子**

のみ。

---

## 7.2 watermark_seed

例

watermark_seed =
HMAC(secret,
entitlement_id +
page_id +
lang +
session_bucket
)

---

## 7.3 生成フロー

ユーザー画像リクエスト
↓
entitlement確認
↓
seed生成
↓
画像に微差分注入
↓
配信

---

# 8. Traceability

流出画像が見つかった場合

画像特徴抽出
↓
seed推定
↓
entitlement候補取得
↓
発行履歴照合

これにより

- 出所特定
- 系統推定

が可能になる。

---

# 9. Contributor Reward

翻訳などの貢献者に
閲覧権を付与できる。

---

## 9.1 reward 発行

proposal
↓
approved
↓
reward entitlement

source

contributor_reward

---

## 9.2 reward 例

- volume_access
- series_access
- early_access

---

# 10. Promo Entitlement

プロモーション用。

例

- レビュー用配布
- インフルエンサー配布
- イベントコード

---

# 11. Admin Grant

管理者が直接付与。

用途

- テスト
- 補償
- サポート

---

# 12. Entitlement の強み

この設計により

- 決済
- 貢献報酬
- プロモーション
- 管理者付与

すべて同一モデルで扱える。

結果として

- コード管理が単純になる
- 権利の可視化が容易になる
- ウォーターマーク生成が統一される

---

# 13. この設計の本質

このモデルは

**購入システム**

ではない。

これは

**漫画のアクセス権インフラ**

である。

ユーザーは

- 購入
- 貢献
- 招待

など様々な方法で

**Entitlement（閲覧権）**

を得る。

そしてその権利に基づいて
コンテンツが配信される。