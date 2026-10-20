# Supabase × Go on AWS Lambda 連携調査

- 調査日: 2026-10-16
- 対象構成: Next.js (Vercel) + Go on AWS Lambda (provided.al2023, VPC 外) + API Gateway HTTP API + Supabase (Postgres / Auth)
- 出典の扱い: 一次情報（Supabase 公式ドキュメント・公式ブログ、AWS 公式ドキュメント、ライブラリのソースコード / pkg.go.dev）のみ。参照した Supabase / AWS のドキュメントページには更新日の表記がなく、更新日は確認できなかった（各節で「更新日表記なし」と記載）。

## 要約

1. VPC 外の Lambda は IPv6 で外向き通信できない（AWS 公式）。Supabase の直接接続は、IPv4 アドオン（有料、Pro 以上）を付けない限り IPv6 なので、無料プランの Lambda からは Supavisor 共有プーラー（全プランで IPv4）を使うことになる。サーバーレス向けに Supabase が推奨しているのは transaction mode（6543 番ポート）で、prepared statement は使えない。
2. Supabase Auth は 2025-10-01 以降、新規プロジェクトで非対称 JWT（ES256 推奨、RS256 も選べる）がデフォルトになっている。JWKS は `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`。HS256 の共有 secret は「推奨しない（後方互換のため残している）」扱い。
3. API Gateway HTTP API の JWT Authorizer は「RSA 系アルゴリズムのみ」対応なので、Supabase の推奨である ES256 の JWT は検証できない。RS256 鍵を current にすれば `iss` / `aud` / `kid` の要件は満たせる見込みが高い（実機では未確認）。無料プランには、7 日間活動がないと一時停止される、DB 500 MB、egress 5 GB、アクティブなプロジェクトは 2 つまで、MAU 50,000 という制限がある。

---

## 1. DB 接続方式

### 1.1 接続方式の比較

| 方式 | ポート / 形式 | IP | prepared statement | 公式の想定用途 |
|---|---|---|---|---|
| 直接接続 | `postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres` | IPv6（IPv4 アドオンを付けた場合は IPv4） | 対応 | VM や長時間稼働するコンテナなど、常時稼働するバックエンド |
| Supavisor 共有プーラー session mode | `postgresql://postgres.[REF]:[PW]@[POOLER-HOST]:5432/postgres` | IPv4 のみ（全プラン） | 対応 | IPv4 環境の常時稼働バックエンド、自分で管理できないネットワーク上のツール |
| Supavisor 共有プーラー transaction mode | `postgresql://postgres.[REF]:[PW]@[POOLER-HOST]:6543/postgres` | IPv4 のみ（全プラン） | 非対応 | サーバーレス・エッジ関数（短命な接続を大量に張る環境） |
| 専用プーラー（有料プランのみ） | — | 既定は IPv6 | transaction mode のみ | — |
| Data API（PostgREST） | `https://<project_ref>.supabase.co/rest/v1/` | HTTPS | 該当なし | HTTP 経由のアクセス。RLS が適用される |

出典:
- 接続方式・ポート・接続文字列の形式・IPv4/IPv6・prepared statement の可否: https://supabase.com/docs/guides/database/connecting-to-postgres （更新日表記なし）
  - "Direct connections are on IPv6, or on IPv4 if the project has the IPv4 add-on."
  - "The shared pooler is IPv4-only on every plan."
  - "Transaction mode does not support prepared statements"
  - transaction mode では、クエリのパイプライン、`SET` などのセッション状態、`LISTEN`/`NOTIFY`、一時テーブル、トランザクションをまたぐカーソルも使えない。
  - pooler のホスト名はリージョンから導けないため、Dashboard の Connect ダイアログから取得する。プーラー経由のときのユーザー名は `postgres.[PROJECT-REF]`。
- prepared statement に関する補足: https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL （更新日表記なし）
  - "although the direct connections and Supavisor in session mode support prepared statements ... Supavisor in transaction mode does not."
- Data API: https://supabase.com/docs/guides/api （更新日表記なし）。キー認証を有効にした API ゲートウェイの後ろに置かれ、Postgres の RLS・ロール・権限に従う。
- API キーとロールの対応: https://supabase.com/docs/guides/api/api-keys （更新日表記なし）。publishable key は `anon` ロールに対応し、ユーザーがサインインしていれば `authenticated` になる。secret key は `service_role` に対応し、`BYPASSRLS` を持つため RLS をすべて無視する。

補足: Supavisor の GitHub README（https://github.com/supabase/supavisor ）には prepared statement の記述がなく、session mode を「Future work」に挙げている。Supabase 公式ドキュメント（session mode 対応済み）と食い違っており、README の更新が追いついていないと見られる。Supavisor の transaction mode が将来 prepared statement に対応するかは**未確認**。

### 1.2 サーバーレス環境で Supabase が推奨している設定

https://supabase.com/docs/guides/database/connecting-to-postgres より:
- transaction mode は "Recommended for serverless and edge functions, which open many short-lived connections."
- クライアントはリクエストごとではなくモジュールスコープで 1 回だけ作る。
- "Set the pool to 1 connection."
- prepared statement を無効にする。
- SSL を `require` にする。

https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers （更新日表記なし）にも、サーバーレス環境の接続問題はたいてい「プールサイズ、prepared statement、SSL」の 3 設定が原因、とある。ただしこのページには Go / pgx の記述はない。

### 1.3 Go (pgx v5) で prepared statement を無効にする方法

Supabase 公式ドキュメントに Go / pgx 固有の手順は**見当たらなかった**。以下は pgx 側の一次情報。

- pgx は既定で extended protocol を使い、prepared statement を自動で作ってキャッシュする（既定値 `QueryExecModeCacheStatement`）。接続文字列パラメータ `default_query_exec_mode` には `cache_statement` / `cache_describe` / `describe_exec` / `exec` / `simple_protocol` を指定できる。
  出典: https://pkg.go.dev/github.com/jackc/pgx/v5 （閲覧時点の表示は v5.11.0、2026-09-07 公開。タグ一覧 https://github.com/jackc/pgx/tags にも v6 は見当たらない）
- 各モードの説明（ソースコードのコメント）。出典: https://github.com/jackc/pgx/blob/master/conn.go
  - `QueryExecModeExec`: "Assume the PostgreSQL query parameter types based on the Go type of the arguments. This uses the extended protocol with text formatted parameters and results. Queries are executed in a single round trip." 名前付き prepared statement は使わない。型があいまいな引数（例: `map[string]string`）は拒否される。
  - `QueryExecModeSimpleProtocol`: クライアント側でパラメータを埋め込む。"Prefer QueryExecModeExec over QueryExecModeSimpleProtocol whenever possible." "In general QueryExecModeSimpleProtocol should only be used if connecting to a proxy server, connection pool server, or non-PostgreSQL server that does not support the extended protocol." `[]byte` は bytea として扱われるため、text / json / jsonb には `string` を使う必要がある。
  - `QueryExecModeDescribeExec`: "This may cause problems with connection poolers that switch the underlying connection between round trips." transaction pooling とは相性が悪い。
  - `QueryExecModeCacheDescribe`: 名前付き prepared statement を使わずに記述情報だけをキャッシュする。pkg.go.dev の PgBouncer に関する節で、PgBouncer と組み合わせて使えるモードとして挙げられている。
- pkg.go.dev の PgBouncer に関する節: prepared statement に対応していないプーラーでは `ConnConfig.DefaultQueryExecMode` を `QueryExecModeExec` にする。CacheDescribe と SimpleProtocol も動くが、"Exec is preferred over SimpleProtocol"。

設定例（pgx の API に沿った書き方。Supabase との組み合わせで実際に動くかは**未確認**）:

```go
cfg, _ := pgxpool.ParseConfig(os.Getenv("DATABASE_URL")) // 6543番ポートの transaction pooler URI, sslmode=require
cfg.MaxConns = 1
cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
// 接続文字列で指定する場合: ...?sslmode=require&default_query_exec_mode=exec
```

Supavisor は PgBouncer ではないので、上記の PgBouncer 向けの指針が Supavisor にもそのまま当てはまるかは**未確認**。ただし、Supabase は「transaction mode では prepared statement を無効にする」とだけ言っており、名前付き prepared statement を使わない `exec` / `simple_protocol` はこの条件を満たす。

### 1.4 IPv4 / IPv6 と Lambda（VPC 外）

- AWS Lambda: "Lambda doesn't support outbound IPv6 connections for IPv6-only subnets in a VPC or outbound IPv6 connections for functions that are not connected to a VPC."
  出典: https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html#configuration-vpc-ipv6 （更新日表記なし）
  - 外向きの IPv6 通信には、デュアルスタックのサブネットを持つ VPC に接続し、`Ipv6AllowedForDualStack=true` を指定する必要がある（同ページ）。IPv6 通信で egress-only internet gateway を使えば NAT Gateway なしで済む可能性がある、とも書かれている: https://aws.amazon.com/blogs/compute/aws-lambda-networking-over-ipv6/
- 以上から、VPC 外の Lambda から Supabase の直接接続（既定は IPv6）には届かない。
- Supabase の IPv4 アドオン:
  - "Dedicated IPv4 Add-On (Pro Plans+)"。有料で、直接接続に固定の IPv4 アドレスを割り当てる。Supavisor は常に IPv4 なので、アドオンは不要。出典: https://supabase.com/docs/guides/platform/ipv4-address （更新日表記なし）
  - 料金: "$0.0055 per hour ($4 per month)"。時間単位の課金（1 時間未満は切り上げ）で、リードレプリカごとにも課金され、Spend Cap の対象外。出典: https://supabase.com/docs/guides/platform/manage-your-usage/ipv4 （更新日表記なし）
  - アドオンを有効にすると AAAA レコードが A レコードに置き換わり、IPv4 専用になる。出典: https://supabase.com/docs/guides/database/connecting-to-postgres

### 1.5 接続数の上限（無料プラン）

- 無料プランのコンピュートは Nano。直接接続の上限は 60、Connection pooler のクライアント上限は 200、RAM は最大 0.5 GB、CPU は共有。"Compute resources on the Free plan are subject to change."
  出典: https://supabase.com/docs/guides/platform/compute-and-disk （更新日表記なし）
- Lambda の同時実行数とプーラーのクライアント上限 200 の関係（Lambda の 1 実行環境が 1 接続を使うとすると、同時実行が 200 を超えると上限に達する）は上の数値から導いたもので、実測はしていない（**未確認**）。

---

## 2. Supabase Auth の JWT 署名方式

### 2.1 非対称鍵（JWT Signing Keys）の現状

- 2025-07-14 公開の公式ブログ「Introducing JWT Signing Keys」: https://supabase.com/blog/jwt-signing-keys
  - "all *new projects* will use asymmetric JWTs by default"（2025-10-01 以降）。
  - 2025-10-01: 既存プロジェクトのレガシー JWT secret を新しい Signing Keys の仕組みへ自動で移行（既存の secret 自体は変わらない）。
  - 2025-11-01: 新しい API キー（publishable / secret）への切り替えを促すリマインダーの送信を開始。この日以降に restore したプロジェクトには anon / service_role キーが付かない。
  - 2026 年後半（"TBC"）: すべてのプロジェクトで anon / service_role キーからの移行が必須になる予定。
- API Keys のドキュメントでも、レガシーの anon / service_role キーは "by the end of 2026" までに廃止予定とされている: https://supabase.com/docs/guides/api/api-keys （更新日表記なし）。調査日（2026-10-16）時点で廃止が実施されたかどうかは**未確認**。
- 対応アルゴリズム（https://supabase.com/docs/guides/auth/signing-keys 、更新日表記なし）:
  - **ES256**（P-256）: 推奨。"Elliptic Curves are a faster alternative than RSA, while providing comparable security."
  - **RS256**（RSA 2048）: 使えるが、"We recommend using the P-256 elliptic curve instead."
  - **EdDSA**（Ed25519）: "Coming soon"
  - **HS256**（共有 secret）: "Not recommended for production applications."
  - 自分の秘密鍵をインポートすることもできる（例: `supabase gen signing-key --algorithm ES256`）。
  - 新規プロジェクトや移行時に自動で作られる鍵のアルゴリズムが ES256 なのか RS256 なのかは、ドキュメントにも公式ブログにも書かれておらず**未確認**。RS256 を使う場合は、RS256 の鍵を standby として作成し、current にローテーションする流れになる（同ページの鍵ライフサイクルの説明より）。
- 鍵のライフサイクル: standby → current → previously used → revoked。ローテーションで変わるのは新しく発行される JWT の署名鍵だけで、古い鍵で署名された有効期限内のトークンは引き続き受け入れられる。鍵の状態変更には約 5 分のスロットリングがある（同ページ）。

### 2.2 JWKS エンドポイントとキャッシュ

- URL: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`（公開鍵のみ。非対称鍵を使っていなければ鍵は返らない）
  出典: https://supabase.com/docs/guides/auth/signing-keys 、 https://supabase.com/docs/guides/auth/jwts
- OIDC discovery: `https://<project-ref>.supabase.co/auth/v1/.well-known/openid-configuration`（`/auth/v1/.well-known/oauth-authorization-server` と同じメタデータを返す）
  出典: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows 、 https://supabase.com/docs/guides/auth/oauth-server/getting-started （どちらも更新日表記なし）
  - OAuth 2.1 Server 機能を無効にしているプロジェクトでも、この discovery エンドポイントが `jwks_uri` を返すかどうかは**未確認**。GitHub Issue には「無効にしていても 200 を返す」という報告があるが、公式ドキュメントでは確認できない。
- キャッシュ: Supabase のエッジが 10 分キャッシュし、クライアントライブラリがさらにメモリ上で最大 10 分キャッシュすることがある。"Make sure that you do not cache this data for longer in your application." standby 鍵の作成や鍵の失効のあとは、少なくとも 20 分待つ。
  出典: https://supabase.com/docs/guides/auth/jwts 、 https://supabase.com/docs/guides/auth/signing-keys
- HS256 のプロジェクトで JWT を検証する場合、公式は `GET /auth/v1/user` で Auth サーバーに問い合わせて検証するよう勧めており、共有 secret を使ったローカル検証には "We strongly recommend against" としている。出典: https://supabase.com/docs/guides/auth/jwts

### 2.3 アクセストークンのクレーム

出典: https://supabase.com/docs/guides/auth/jwt-fields 、 https://supabase.com/docs/guides/auth/jwts （どちらも更新日表記なし）

| クレーム | 値 |
|---|---|
| `iss` | `https://<project-ref>.supabase.co/auth/v1`（anon / service_role キーの例では `"supabase"`） |
| `aud` | ユーザーのトークンは `"authenticated"`、匿名ユーザーは `"anon"`（型は `string \| string[]`） |
| `sub` | ユーザー ID（UUID） |
| `role` | `authenticated` / `anon` / `service_role` |
| `exp` / `iat` | Unix 時刻 |
| `nbf` | 任意（入らないこともある） |
| その他 | `aal`, `session_id`, `is_anonymous` など |
| ヘッダ `kid` | JWKS の鍵の `kid` と一致させる（jwts ページ）。jwt-fields ページには記載なし |

OAuth Flows のドキュメントでは、検証のチェック項目として `iss` がプロジェクト URL と一致すること、`aud` が `authenticated` であることを挙げている: https://supabase.com/docs/guides/auth/oauth-server/oauth-flows

### 2.4 API Gateway HTTP API の JWT Authorizer で検証できるか

AWS 側の仕様（https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html 、更新日表記なし）:
- 公開鍵は issuer の `jwks_uri` から取得する。"Currently, only RSA-based algorithms are supported."
- 公開鍵のキャッシュは "for up to two hours on a best-effort basis"。キャッシュにない場合はネットワーク越しに取得するので、そのリクエストのレイテンシが増える。鍵のローテーションでは、新旧の鍵が両方有効な猶予期間を設けるよう求めている。
- 検証するクレーム: `kid`（JWKS の鍵と一致）、`iss`（設定した issuer と一致）、`aud`（`aud` がなければ `client_id`）が audience のいずれかと一致、`exp`、`nbf`、`iat`、`scope`/`scp`（ルートにスコープを設定した場合のみ）。
- 検証に通ると、クレームが `$event.requestContext.authorizer.jwt.claims.*` として Lambda に渡される。
- `issuer` は "The base domain of the identity provider that issues JSON Web Tokens"、`audience` は "A valid JWT must provide an aud that matches at least one entry in this list."
  出典: https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid-authorizers-authorizerid.html

Supabase と照らし合わせた結果（上の一次情報同士を突き合わせたもので、実機では検証していない）:
- **ES256 の JWT は、AWS の「RSA 系のみ」という制約に合わないため検証できない**。Supabase が推奨しているのは ES256。
- RS256 の鍵を current にすれば、アルゴリズムの制約は満たせる。
- issuer は `https://<project-ref>.supabase.co/auth/v1`、audience は `authenticated` になる見込み。匿名サインインを使う場合は、`aud` が `anon` になることを考慮する必要がある。
- API Gateway が `jwks_uri` を見つける具体的な方法（`<issuer>/.well-known/openid-configuration` を参照するのかどうか）は、AWS のドキュメントに明記されておらず**未確認**。Supabase は `<issuer>/.well-known/openid-configuration` に discovery を公開しているが、その中の `jwks_uri` の値も**未確認**。
- `iat` / `nbf` のチェックはクレームがある場合の検証と読めるが、`nbf` がないトークンを API Gateway が拒否しないかどうかは**未確認**。
- キャッシュ期間が合っていない: AWS は最大 2 時間キャッシュし、Supabase は「10 分より長くキャッシュしないこと」「失効後は 20 分待つこと」と求めている。鍵を失効させても、API Gateway 側では最大 2 時間程度、古い鍵が使われ続ける可能性がある。

### 2.5 Go で JWT を検証する代表的なライブラリ

Supabase の公式ドキュメントは特定の Go ライブラリを勧めておらず、"a JWT verification library for your language" を使うよう言っているだけ（https://supabase.com/docs/guides/auth/jwts ）。公式ブログも "You can also use any other JWT library." としている。

- `github.com/golang-jwt/jwt/v5` と `github.com/MicahParks/keyfunc/v3` の組み合わせ: keyfunc は golang-jwt v5 向けに、JWKS を使った鍵の取得関数を提供する。`NewDefault` を使うと JWKS を自動で更新し、未知の `kid` が来たときにも更新する。閲覧時点の表示は v3.8.2（2026-09-04）。出典: https://pkg.go.dev/github.com/MicahParks/keyfunc/v3
- `github.com/lestrrat-go/jwx`: `jwk.Cache` で JWKS を最新に保つ。閲覧時点では v3.3.0（2026-09-08）の表示に加えて "The highest tagged major version is v4" とあり、v4 が出ている。出典: https://pkg.go.dev/github.com/lestrrat-go/jwx/v3
- どちらのページにも ES256 / RS256 への対応が明記されているわけではない。JWS の標準アルゴリズム（RFC 7518）を実装しているので対応しているはずだが、各ページでは確認しておらず**未確認**。

---

## 3. 無料プランの運用上の制約

| 項目 | 値 | 出典 |
|---|---|---|
| アクティブなプロジェクト数 | 2（Owner / Administrator として所属する全 Organization の合計。一時停止中のプロジェクトは数えない） | https://supabase.com/pricing 、 https://supabase.com/docs/guides/platform/billing-on-supabase |
| DB サイズ | 1 プロジェクトあたり 500 MB | 同上 |
| Egress | 5 GB（別にキャッシュ経由の egress が 5 GB） | https://supabase.com/pricing |
| MAU | 50,000 | 同上 |
| ファイルストレージ | 1 GB | 同上 |
| Edge Functions の呼び出し回数 | 500,000 回 / 月 | 同上 |
| Realtime | メッセージ 200 万件、ピーク時の同時接続 200 | https://supabase.com/docs/guides/platform/billing-on-supabase |
| コンピュート | Nano（CPU は共有、RAM は最大 0.5 GB）、直接接続 60、プーラーのクライアント 200 | https://supabase.com/docs/guides/platform/compute-and-disk |

一時停止（pause）について（https://supabase.com/docs/guides/platform/free-project-pausing 、更新日表記なし）:
- "Supabase pauses Free Plan projects that show low activity over a 7-day period"
- "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week." 停止を避けるには "a few user requests to the database each day" で足りる、とされている。「十分な活動」の具体的な基準（回数など）は書かれておらず**未確認**。
- 復元: "You can restore a paused project for up to 1 year after it was paused."（2024-06 の Changelog では 90 日とされていたが、現在のドキュメントでは 1 年。ページ内のアンカー名は今も `90-day-window` のまま: https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days ）
- 有料プランのプロジェクトは自動では停止されない。

無料枠の上限を超えた場合の挙動（読み取り専用になる、制限がかかる、など）は、参照したページには書かれておらず**未確認**。

---

## 設計判断への示唆（事実から言えること）

- VPC 外の Lambda（IPv4 のみ）から無料プランの Supabase Postgres に TCP で接続するには、Supavisor 共有プーラーを使うしかない（直接接続は IPv6 で、IPv4 アドオンは Pro 以上・月 $4 程度）。IPv6 で直接接続するには Lambda を VPC（デュアルスタック）に入れる必要があり、「VPC 外で動かす」という前提と矛盾する。
- Supabase がサーバーレス向けに推奨しているのは transaction mode（6543 番ポート）＋プールサイズ 1＋prepared statement 無効＋SSL require。pgx では `QueryExecModeExec`（または `simple_protocol`）がこの条件に当てはまる。`LISTEN/NOTIFY` やセッション変数、一時テーブルを使う設計は transaction mode では成り立たない。
- プーラーのクライアント上限（無料プランで 200）があるので、Lambda の同時実行数をこれより低く抑えるかどうかが論点になる。
- DB に TCP で接続しない方法として、Data API（HTTPS、RLS 適用）もある。この場合、接続数や prepared statement の制約は関係しない。代わりに API キー（publishable / secret）の扱いが論点になる。secret key は RLS をすべて無視する。
- API Gateway の JWT Authorizer で検証するには、Supabase の署名鍵を RS256 にする必要がある（Supabase の推奨は ES256）。ES256 のままにするなら、検証は Lambda 内（Go のライブラリ）か Lambda Authorizer で行うことになる。
- API Gateway の JWKS キャッシュ（最大 2 時間）は、Supabase が求めるキャッシュ期間（10〜20 分）より長い。鍵のローテーションや失効をすぐに反映させたい場合、この差が問題になる。
- `aud` は通常のユーザーが `authenticated`、匿名ユーザーが `anon`。匿名ユーザーも API の対象にするなら、audience の設定でそれを考慮する必要がある。
- レガシーの anon / service_role キーと HS256 secret は、廃止予定または非推奨。新しく設計するなら、publishable / secret キーと非対称鍵を前提にするのが公式の方針と合う。
- 無料プランは、7 日間活動がないと一時停止される（復元できる期間は 1 年）。利用が少ない期間があるサービスでは、停止されることを前提にした運用を考えるか、有料プランを検討するかが論点になる。DB 500 MB と egress 5 GB も容量見積もりの前提になる。
- 実機で確認すべき**未確認**事項: discovery の `jwks_uri`、新規プロジェクトで既定になる鍵のアルゴリズム、API Gateway が `nbf` のないトークンをどう扱うか、Supavisor と pgx の `exec` モードの組み合わせ、無料枠を超えたときの挙動。
