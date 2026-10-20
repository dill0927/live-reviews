# データストア・認証の選択肢調査（SEKI-REPO リプレイス）

- 調査日: 2026-10-20
- 根拠: 公式ドキュメント・公式料金ページ・公式変更履歴のみ。各主張に出典 URL を付ける。公式ページで確認できなかった点は「未確認」と書く。
- 前提: Next.js（Vercel）＋ Go on AWS Lambda（VPC 外）＋ API Gateway HTTP API。AWS アカウントは 2024-12 作成で、12 か月無料枠は終了済み（Always Free のみ）。NAT Gateway・RDS などの固定費リソースは使わない。

## 要約

- **固定費ゼロで常時使える候補**: Aurora DSQL（毎月 100,000 DPU と 1 GB が無料、Always Free）、DynamoDB（25 GB と 25 RCU/WCU）、Neon Free（5 分でスケールゼロ、次のクエリで自動復帰）。Supabase Free は 1 週間アクティビティがないとプロジェクトが一時停止し、復帰はダッシュボードからの手動操作。Aurora Serverless v2 は 0 ACU まで自動停止できるが、VPC が前提で、ストレージ料金と周辺の固定費（パブリック IPv4 または Secrets Manager）がかかる。
- **X（Twitter）ログイン**: Supabase Auth には X（OAuth 2.0）プロバイダが組み込みである。Cognito の組み込みソーシャルは Google / Facebook / Apple / Amazon の 4 つだけ。X の公式スコープ一覧に `openid` はなく、OIDC IdP として登録する前提（ID トークン・jwks）を満たすことも公式には確認できなかった。Neon Auth の OAuth は Google / GitHub / Vercel で、X はない。
- **匿名投稿**: Supabase は匿名サインインがあり、後から本登録ユーザーに昇格（identity の linking）できる。Cognito は Identity Pool のゲスト ID で扱えるが、発行されるのは AWS 一時認証情報で、User Pool の JWT ではない。

## 候補比較表

| 候補 | 無料枠 | 固定費 | 停止の有無 | Lambda（VPC 外）からの接続 | X ログイン |
|---|---|---|---|---|---|
| Supabase Free（DB＋Auth） | DB 500 MB/プロジェクト、50,000 MAU、アクティブなプロジェクトは 2 つまで | 0 円（Pro は月 $25 から） | **あり**: 1 週間アクティビティが少ないと一時停止。復帰はダッシュボードから手動 | インターネット経由で Postgres に接続、または HTTP API | **あり**（X / Twitter (OAuth 2.0)） |
| Amazon Cognito（認証のみ） | Lite / Essentials は 10,000 MAU（期限なし）。SAML/OIDC 連携ユーザーは 50 MAU | 0 円（ユーザープール自体に固定費はない） | なし | AWS API / JWT（HTTP API の JWT オーソライザー） | **組み込みにはない**。OIDC として登録できるかは未確認（後述の理由で難しいとみられる） |
| Aurora DSQL | 毎月 100,000 DPU＋1 GB ストレージ（Always Free） | 0 円（アイドル時の DPU 課金なし） | なし（アイドル時は自動でゼロまでスケール） | パブリックエンドポイント＋IAM 認証トークン。Go は pgx のサンプルあり | 対象外（DB） |
| DynamoDB | 25 GB、25 WCU / 25 RCU（プロビジョンド、Standard テーブルクラス） | 0 円 | なし | HTTPS（AWS SDK） | 対象外（DB） |
| Aurora Serverless v2（PostgreSQL） | 枠の利用条件は 2024-12 作成アカウントでは未確認（後述） | ストレージ $0.10/GB-月。パブリックアクセスなら IPv4 が $0.005/時、Data API なら Secrets Manager が $0.40/シークレット-月 | 0 ACU で自動停止（最短 5 分）。復帰は通常約 15 秒、24 時間以上停止していると 30 秒以上 | VPC 内に作成が前提。パブリックアクセスにするか、RDS Data API（HTTPS）を使う | 対象外（DB） |
| Neon Free（DB＋Neon Auth） | 1 GB/プロジェクト（全体で 20 GB）、100 CU 時間/プロジェクト、100 プロジェクト、Neon Auth 60k MAU | 0 円（有料プランも最低料金なし） | 5 分でスケールゼロ（無効化はできない）。次のクエリで自動復帰。プロジェクトの一時停止はない | TCP（pooler ホスト名）。Go は標準の TCP ドライバ | **なし**（Google / GitHub / Vercel） |

## 1. Supabase 無料プラン

### 一時停止の条件

- 料金ページの記述: 「Free projects are paused after 1 week of inactivity.」有料プランのプロジェクトは非アクティブでも停止されない。出典: https://supabase.com/pricing
- 公式ドキュメント（Project Pausing）の定義: 「A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week.」通常は、直近 1 週間に毎日数回 DB へのユーザーリクエストがあれば停止を避けられる、とされている。出典: https://supabase.com/docs/guides/platform/free-project-pausing
- **アクティビティに数えられるもの**: 同じページには、停止予告メールを受けたあとに停止を防ぐ方法として次の 3 つが挙がっている。
  - ダッシュボードからプロジェクトを開く
  - プロジェクトに API コールを送る
  - 接続しているアプリからリクエストを送る

  「sufficient」が具体的に何件なのか、どの種類のリクエスト（REST / Auth / Storage / 直接の DB 接続）が数えられるのかは、閾値も含めて**未確認**。
  出典: https://supabase.com/docs/guides/platform/free-project-pausing
- **定期アクセスで停止を避けることの規約上の扱い**: ドキュメントには「API を呼べば停止を防げる」とあるが、cron などで機械的にキープアライブすることを許可または禁止する明文は、Project Pausing ページにも Terms of Service（https://supabase.com/terms）の検索結果にも見つからなかった。**未確認**。公式が案内している恒久的な対策は Pro プランへのアップグレードだけ。出典: https://supabase.com/docs/guides/platform/free-project-pausing

### 一時停止中の挙動と復帰

- 一時停止中のプロジェクトへのリクエストは **HTTP 540**（「The project the request was being made against has been paused.」）を返し、オーナーが再開するまで処理されない。出典: https://supabase.com/docs/guides/platform/http-status-codes
- 復帰方法: ダッシュボードで組織とプロジェクトを選び、「Resume project」を押して確認する。データと設定は元の状態に戻る。停止から **1 年以内**なら復元できる。出典: https://supabase.com/docs/guides/platform/free-project-pausing
  - 2024-06 の変更履歴には「90 日間」とあるが、現行ドキュメントは 1 年。出典: https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days
- 復帰にかかる時間: **未確認**（公式ページに記載なし）。
- 一時停止中のプロジェクトは「アクティブなプロジェクト 2 つ」の上限に数えられず、課金もない。出典: https://supabase.com/docs/guides/platform/billing-faq

### Pro プランの料金

- 「from $25/month」。月 $10 の Compute Credits（Micro インスタンス 1 台分）を含む。出典: https://supabase.com/pricing

## 2. Amazon Cognito

### 料金体系と無料枠

出典: https://aws.amazon.com/cognito/pricing/

- **Lite**: 基本的な登録・認証・ユーザー管理。ソーシャル・SAML・OIDC サインインを含む。無料枠は 10,000 MAU で、それを超えると段階料金。
- **Essentials**: 新しいユーザープールの既定。Managed Login とパスワードレスが加わる。無料枠は 10,000 MAU で、超過分は $0.015/MAU。
- **Plus**: 脅威保護などが加わる。無料枠なし（例では $0.020/MAU）。
- **無料枠の期間**: 「The free tier does not automatically expire at the end of your 12-month AWS Free Tier term」とあり、期間の制限はない。つまり 12 か月限定ではない。
- **課金区分**:
  - ソーシャル IdP 経由のサインインは「direct（ユーザープールの認証情報によるサインイン）」と同じ区分（「includes social identity providers」）。
  - SAML 2.0 / OIDC IdP で連携したユーザーは別の区分で、どの tier でも無料枠は **50 MAU**、超過分は $0.015/MAU。
  - X を仮に OIDC IdP として登録できた場合は、後者の 50 MAU 枠に入ると読める（この読み方は推測を含む）。
- Identity Pool（認証と一意 ID の発行）は無料（「is provided at no charge」）。

### X（Twitter）をソーシャルログインに使えるか

- ユーザープールに組み込まれているソーシャル IdP は **Google / Sign in with Apple / Facebook / Login with Amazon の 4 つだけ**で、X は含まれない。出典: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp.html
- 汎用の OIDC IdP として登録する場合、IdP には次の条件が求められる。出典: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-idp.html
  - `client_secret_post` によるクライアント認証に対応していること（`client_secret_basic` は非対応）
  - `jwks_uri` で `kid` を公開し、ID トークンに署名していること
  - `openid` スコープが必須であること
- X 側の状況: X の公式スコープ一覧（`tweet.read`, `users.read`, `users.email`, `offline.access` など）に `openid` はない。トークン交換は、機密クライアントの場合 Basic 認証ヘッダーを使う例が示されている。出典: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
  - このため、X の OAuth 2.0 を Cognito の OIDC IdP としてそのまま登録するのは難しいとみられる。ただし、X が OIDC 非対応だと明言した公式記述は見つけられず、**未確認**。
  - 回避策（自前で OIDC を仲介するプロキシを立てる、Lambda で独自にフローを組み、カスタム認証や開発者認証 ID を使う、など）の公式手順は確認していない。

### メール送信

出典: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html 、https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html

- 既定のメール設定（`COGNITO_DEFAULT`）でも送信でき、SES の設定は必須ではない。差出人は `no-reply@verificationemail.com`。独自の差出人を使うには、SES での検証と送信許可ポリシーが必要。
- 既定のメール設定の上限は **1 AWS アカウントあたり 1 日 50 通**（引き上げ不可、毎日 09:00 UTC にリセット）。公式は「For typical production environments, the default email limit is below the required delivery volume」と書いている。
- 自分の SES 構成を使う場合は、SES のサンドボックスを抜けないとユーザーに送信できない。SES の料金は別途かかる。
- メール MFA と OTP によるサインインには、Essentials 以上かつ SES 構成が必要。

### 匿名ユーザーの扱い

- Identity Pool の「Guest access（unauthenticated identities）」を有効にすると、ログインしていないユーザーにも一意の ID と、ゲスト用 IAM ロールの **AWS 一時認証情報**が発行される。出典: https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html
- ゲストがあとで IdP でログインすると、同じ ID が保たれ、プロファイルが統合される（ログインがすでに別の ID に紐づいている場合はマージされ、ID が変わることがある）。出典: https://docs.aws.amazon.com/cognito/latest/developerguide/switching-identities.html 、https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html
- ゲストが得るのは IAM 認証情報で、ユーザープールの JWT ではない。そのため、API Gateway HTTP API の JWT オーソライザーでそのまま検証できるかは**未確認**（IAM 認可を使う構成になると考えられるが、公式で確認していない）。

## 3. AWS 側のデータストア候補

### 3a. Amazon Aurora DSQL

- **無料枠**: 「Each month, your first 100,000 DPUs and 1 GB of storage are free」。出典: https://aws.amazon.com/rds/aurora/dsql/pricing/
  - RDS の Free Tier ページに「Aurora DSQL is an always free service」とあり、Free プランと Paid プランの両方に適用される。出典: https://aws.amazon.com/rds/free/
  - 2024-12 作成のレガシー Free Tier アカウントにも同じ枠が適用されるとは明記されていないが、「Always Free は新旧どちらのプログラムでも利用できる」とされている。出典: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-free-tier.html
- **料金**: 1M DPU あたり $8（US East (Ohio) の例）。ストレージは $0.33/GB-月。東京リージョンの単価は料金ページで確認できず、**未確認**。出典: https://aws.amazon.com/rds/aurora/dsql/pricing/
- **PostgreSQL 互換性の主な制約**（出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-migration-guide.html）
  - **外部キー**: 現在は**サポートされている**（NO ACTION / RESTRICT / CASCADE / SET NULL / SET DEFAULT、遅延制約も可）。参照整合性のチェックで読み取りが増え、競合時はシリアライズエラーになる。出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-foreign-key-constraints.html
    - 古い記事では「外部キー非対応」と書かれていることがあるので注意。
  - **シーケンス・IDENTITY 列**: 現在はドキュメントがあり、使える（割り当てとキャッシュの挙動は CREATE SEQUENCE のページを参照）。ただし公式は分散のため UUID などを推奨している。出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/sequences-identity-columns.html
  - **トリガー**: 非対応の扱い（アプリ層や EventBridge で代替するよう案内されている）。PL/pgSQL は非対応で、SQL 関数のみ使える。
  - **その他**:
    - 一時テーブルなし
    - TRUNCATE の代わりに DELETE を使う
    - インデックスは `CREATE INDEX ASYNC`
    - 分離レベルは Repeatable Read 固定
    - 1 トランザクションで変更できるのは 3,000 行まで
    - DDL と DML は別トランザクション
    - 接続は 1 時間でタイムアウト
    - 照合順序は C のみ
    - 楽観的同時実行制御のため、リトライ処理が必要
  - **拡張**: System tables のページで `pg_extension` などが「Not applicable」とされている。`pg_trgm` などの拡張が使えるかは**未確認**（部分一致検索の高速化に関係する）。出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-systems-tables.html
- **接続**: IAM で一時的な認証トークンを生成して接続する（`dsql:DbConnect` / `dsql:DbConnectAdmin`）。出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/authentication-authorization.html
  - パブリックエンドポイントがあり、VPC 外からも接続できる（VPC 外からの接続を拒否するリソースポリシーの例が公式にある。PrivateLink は任意）。出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/rbp-examples.html 、https://docs.aws.amazon.com/aurora-dsql/latest/userguide/privatelink-managing-clusters.html
  - Go は pgx を使ったサンプルがある（aws-samples/aurora-dsql-samples/go/pgx）。出典: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/aws-sdks.html

### 3b. Amazon DynamoDB

- 無料枠: 25 GB のストレージ、25 WCU / 25 RCU（**プロビジョンドキャパシティ**、Standard テーブルクラス）、Streams の読み取り 250 万リクエスト。オンデマンドキャパシティは無料枠の対象外と読める。出典: https://aws.amazon.com/dynamodb/pricing/
- Always Free であること: 「Always free」オファーは期限がなく、レガシー Free Tier でも使える。出典: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-free-tier.html 、https://aws.amazon.com/free/
- 接続は HTTPS の AWS API なので、VPC 外の Lambda から使える。ただし RDB ではないため、集計（会場ごとの平均評価）や部分一致検索は、アプリ側での設計（集計値を書き込み時に更新する、など）が必要になる。

### 3c. Aurora Serverless v2

- **0 ACU（自動停止）**: 最小容量を 0 ACU にすると、ユーザー接続がない状態が続いたときに自動停止する。出典: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html
  - 停止までの時間は 300 秒〜86,400 秒で設定できる。
  - 必要なエンジンバージョン: PostgreSQL 16.3 / 15.7 / 14.12 / 13.15 以上。
  - 停止中はインスタンス料金が 0 になるが、ストレージなどは課金される。
  - 復帰は通常約 15 秒。24 時間以上停止していると、より深いスリープに入って 30 秒以上かかることがある。
  - 保守のために定期的に起動される。RDS Proxy を使うと停止しない。
- **料金**（us-east-1 の例）: $0.12/ACU 時間、ストレージ $0.10/GB-月、I/O $0.20/100 万リクエスト。出典: https://aws.amazon.com/rds/aurora/pricing/
- **VPC 要件**: Aurora クラスターは VPC 内にしか作れない。VPC 外の Lambda から使う方法は 2 つ。
  - パブリックアクセス可能にして、パブリックサブネットとインターネットゲートウェイを使う。出典: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html
    - この場合、パブリック IPv4 アドレスに **$0.005/時**（約 $3.6/月）がかかる。RDS も対象。出典: https://aws.amazon.com/vpc/pricing/
  - **RDS Data API**（HTTPS）を使う。Lambda を VPC に入れずに使える。出典: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html
    - DB の認証情報は Secrets Manager に置く（**$0.40/シークレット-月**、出典: https://aws.amazon.com/secrets-manager/pricing/）。
    - Data API の料金は $0.35/100 万リクエスト（最初の 1 年は 100 万リクエスト無料）。出典: https://aws.amazon.com/rds/aurora/pricing/
    - 停止中のクラスターに Data API でリクエストすると、ライターが自動で再開する。
    - Data API が使えるバージョン・リージョンは別ページにあり、**未確認**。
- **無料枠**: RDS の Free Tier ページにある「Aurora PostgreSQL serverless を最大 4 ACU で使える Free プラン（最大 6 か月）」は、2025-07-15 以降の新規アカウント向けとみられる。2024-12 作成のアカウントには適用されない可能性が高いが、**未確認**。出典: https://aws.amazon.com/rds/free/

## 4. Neon 無料プラン

- **容量など**: 1 GB/プロジェクト（全プロジェクト合計で 20 GB）、100 CU 時間/プロジェクト、100 プロジェクト、egress 5 GB/プロジェクト。出典: https://neon.com/pricing 、https://neon.com/docs/introduction/plans
- **スケールゼロ**: 無料プランでは常に有効で、無効にはできない。5 分間アクティビティがないとコンピュートが停止し、次のクエリで自動的に再開する。出典: https://neon.com/pricing 、https://neon.com/docs/introduction/scale-to-zero
- **プロジェクトの一時停止・削除**:
  - 非アクティブを理由にプロジェクトを一時停止・削除するという記述は見つからなかった。
  - 長期間アイドルのプロジェクトはストレージから「Tenant detach」され、リクエストが来ると再アタッチされる（期間は未記載）。出典: https://neon.com/docs/manage/operations
  - CU 時間か egress の上限に達すると、次の請求期間までコンピュートが停止する。出典: https://neon.com/docs/introduction/plans
  - 利用規約上の非アクティブアカウントの扱いは**未確認**。
- **接続方式**: 出典: https://neon.com/docs/connect/choose-connection
  - サーバーレスドライバ `@neondatabase/serverless`（JS/TS 向け）。HTTP は単発クエリ向け、WebSocket は対話的なトランザクション向け。
  - PgBouncer によるプール接続（ホスト名に `-pooler` が付く。最大 10,000 クライアント接続）。
  - Go は標準の TCP ドライバとプール接続を使う。
- **Neon Auth（Managed Better Auth）**:
  - Better Auth ベースで、ユーザーやセッションは DB の `neon_auth` スキーマに保存される。出典: https://neon.com/docs/auth/overview
  - 無料プランで 60k MAU まで使える。出典: https://neon.com/pricing
  - 対応している方式は、メール＋パスワード、メール OTP、ソーシャル OAuth（**Google / GitHub / Vercel**）。**X はない**。匿名サインインもサポート一覧にない。出典: https://neon.com/docs/auth/roadmap 、https://neon.com/docs/auth/guides/setup-oauth

## 5. Supabase Auth の X 対応と匿名サインイン

- **X（OAuth 2.0）**:
  - 「We recommend using the X / Twitter (OAuth 2.0) provider.」とあり、SDK ではプロバイダ名 `x` を使う（例: `signInWithOAuth({ provider: 'x' })`）。
  - 旧来の「Twitter (OAuth 1.0a)」は「will be deprecated in future releases」。
  - X アプリ側で「Request email from users」を ON にするよう案内されている。
  - 出典: https://supabase.com/docs/guides/auth/social-login/auth-twitter
- **匿名サインイン**: 出典: https://supabase.com/docs/guides/auth/auth-anonymous
  - `signInAnonymously()` で作られるユーザーは、通常のユーザーと同じく `authenticated` ロールを持つ。JWT に `is_anonymous` クレームが入るので、RLS で区別できる。
  - サインアウトしたり、ブラウザのデータを消したり、端末を変えたりすると、そのアカウントには戻れない。
  - **本登録への昇格**: できる。identity を linking する。
    - メール: `updateUser()` でメールを追加する（パスワードを付けるにはメールの確認が先に必要）。
    - OAuth: `linkIdentity()`。
    - 手動の identity linking をプロジェクトで有効にする必要がある。
  - 既定のレート制限は IP あたり 1 時間 30 リクエスト。悪用対策として CAPTCHA（invisible CAPTCHA / Cloudflare Turnstile）を強く推奨している。
  - 匿名ユーザーが MAU に数えられるかは**未確認**。MAU は「請求期間中にサインインまたはトークンを更新したユーザー」と定義されている。出典: https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users

## 設計判断への示唆（判断はしない）

- **X ログインを必須にするか**が、認証基盤を選ぶうえで最も効く分岐になる。
  - 公式に確認できた範囲で、X を組み込みで扱えるのは Supabase Auth だけ。
  - Cognito や Neon Auth を選ぶ場合、X ログインには自前の仲介実装が必要になる見込みで、Cognito では OIDC 連携ユーザーの無料枠（50 MAU）にも注意が要る。
- **Supabase Free の一時停止**をどう受け止めるかが論点になる。
  - 停止中は API が HTTP 540 を返し、復帰は手動。ユーザーがほぼいないポートフォリオでは、停止する条件に当てはまりやすい。
  - 定期アクセスで回避することは、ドキュメント上「API を呼べば防げる」とあるだけで、規約上の可否は未確認。
  - 回避策を採るなら、公式の明確な許可がないリスクを踏まえる必要がある。
- **DB を Supabase と分ける構成**（例: 認証は Supabase、DB は DSQL や Neon）でも、Supabase Auth だけを使っていて「DB アクティビティ」が少ないなら、停止の条件に当たりうる。Auth リクエストがアクティビティに数えられるかは未確認。
- **Aurora DSQL** について。
  - Always Free で、VPC 外から IAM トークンで接続でき、固定費ゼロの目標と合う。
  - 外部キー・シーケンスは現在サポートされている。トリガーや PL/pgSQL はないため、平均評価の集計はアプリ側か SQL 関数で扱う前提になる。
  - 部分一致検索で使いたい拡張（`pg_trgm` など）の可否は未確認。データ量が少ないなら `ILIKE` の全件走査で足りる可能性がある（性能は未検証）。
  - OCC によるリトライ処理と、IAM トークン生成を Lambda に実装する必要がある。
- **Neon Free** について。
  - 停止しても自動で復帰するので、運用の手間は小さい。
  - Go からは TCP で接続でき、Postgres の機能をそのまま使える。
  - X ログインは Neon Auth では賄えない。
- **DynamoDB** は無料枠が最も確実。ただしデータがリレーショナルで、集計と部分一致検索が要件にあるため、データモデルの設計コストが上がる。
- **Aurora Serverless v2** は 0 ACU にできても周辺に固定費が出る（パブリック IPv4 約 $3.6/月、または Data API 用の Secrets Manager $0.40/月とストレージ）。月数十円という目標とは合いにくい。
- **匿名投稿** について。
  - Supabase の匿名サインインなら、あとから本登録に昇格でき、RLS とも統合しやすい。
  - Cognito Identity Pool のゲストは AWS 認証情報なので、HTTP API の JWT オーソライザーと組み合わせる方法は追加の検討が要る。
  - 認証基盤を使わずに、アプリ独自の匿名トークンや IP ベースのレート制限で扱う選択肢もある（公式の比較対象外）。
- **メール＋パスワード認証** を Cognito の既定メールで送る場合、上限は 1 日 50 通。個人ポートフォリオなら足りる可能性が高いが、差出人が `no-reply@verificationemail.com` になる点は UX 上の考慮点になる。
