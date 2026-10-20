# 匿名投稿のスパム・荒らし対策（追加固定費なしの手段）調査

- 調査日: 2026-10-16
- 前提構成: Next.js（Vercel）+ Go on AWS Lambda + API Gateway HTTP API + Supabase。匿名でテキストのみの座席レポを投稿できる
- 根拠: 公式ドキュメント・公式料金ページのみ。各主張に出典を付けた。確認できなかった点は「未確認」と書いた

## 要約

- **Cloudflare Turnstile** は無料プランでもチャレンジ数が無制限で、DNS を Cloudflare に移さなくても使える。トークンの有効期限は 300 秒で、検証できるのは 1 回だけ。サーバー側の siteverify 呼び出しが必須。
- **API Gateway HTTP API** で設定できるのはステージ・ルート単位のレート / バースト制限だけ。IP 単位やクライアント単位の制限はできない。**AWS WAF** は HTTP API に直接アタッチできず、使うなら Web ACL ごとに $5/月の固定費がかかる。例外は CloudFront 定額制の Free プラン（$0）経由で、WAF と IP 単位のレート制限が含まれるが、アカウント要件がある。
- IP 単位の制限を固定費なしで実現するには、Lambda で `requestContext.http.sourceIp` を取得し、Supabase（Postgres）か DynamoDB（Always Free 枠、TTL による削除は書き込みスループットを消費しない）にカウンタを持たせる。

---

## 1. Cloudflare Turnstile

### 1.1 無料プランの条件・上限

| 項目 | Free | Enterprise |
|---|---|---|
| ウィジェット数 | 20 まで | 無制限 |
| チャレンジ数（トラフィック・検証リクエスト） | 無制限 | 無制限 |
| ウィジェットあたりのホスト名 | 10 | 最大 200 |
| 任意のホスト名で使えるウィジェット | なし | あり |
| アナリティクスの参照期間 | 最大 7 日 | 最大 30 日 |
| Ephemeral ID | なし | あり |

- siteverify の呼び出し回数に個別の上限は書かれていない。チャレンジ数は無制限とされている。
- 出典: https://developers.cloudflare.com/turnstile/plans/

### 1.2 Cloudflare に DNS を移さなくても使えるか

- 使える。公式には "You can use Turnstile on any website, regardless of whether it is proxied through the Cloudflare network." とある。
- 出典: https://developers.cloudflare.com/turnstile/get-started/
- ウィジェットごとにサイトキー（クライアント用、公開してよい）とシークレットキー（サーバー検証用）が発行される。作成方法はダッシュボード、API、Terraform の 3 つ。（同上）

### 1.3 サーバー側検証（siteverify）の仕様

- エンドポイントは `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`。`application/x-www-form-urlencoded` と `application/json` のどちらでも送れる。
- パラメータ:
  - `secret`（必須）
  - `response`（必須。クライアントが受け取ったトークン）
  - `remoteip`（任意。訪問者の IP）
  - `idempotency_key`（任意。再試行を安全にするための UUID）
- **トークンの有効期限は 300 秒（5 分）**。期限切れのトークンは `timeout-or-duplicate` で失敗する。
- **トークンは 1 回しか検証できない**。2 回目以降の検証は `timeout-or-duplicate` で失敗する。
- トークンの最大長は 2048 文字。
- レスポンスに含まれるのは `success`、`challenge_ts`、`hostname`、`error-codes`、`action`、`cdata`。`metadata.ephemeral_id` は Enterprise のみ。
- セキュリティ上の注意として、公式は次の 3 点を挙げている。
  - siteverify はバックエンドだけで呼ぶ（"Only call the Siteverify API in your backend environment."）。
  - シークレットキーをフロントエンドに露出すると検証を迂回される。
  - `action` と `hostname` も照合する（"Validate the action and hostname when specified."）。
- エラー処理について、公式は "Have fallback behavior for API failures." と書き、`internal-error` は再試行するよう求めている。失敗時にリクエストを通すか拒否するか（fail-open / fail-closed）は**明記されていない**。
- クライアント側のウィジェットだけではフォームを保護できず、siteverify の呼び出しが必須とされている。
- 出典: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

### 1.4 テスト用キーと localhost

- テスト用サイトキーの例: `1x00000000000000000000AA`（常に成功・Visible）、`2x00000000000000000000AB`（常に失敗）、`3x00000000000000000000FF`（対話型チャレンジを強制）
- テスト用シークレットキーの例: `1x0000000000000000000000000000000AA`（常に成功）、`2x0000000000000000000000000000000AA`（常に失敗）、`3x0000000000000000000000000000000AA`（使用済みトークンのエラーを返す）
- テスト用キーは localhost を含むどのドメインでも使える。本番キーではローカルドメインを許可しないことが推奨されている（Hostname Management で許可すれば使える）。
- 出典: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

### 1.5 Next.js での組み込み（公式の案内）

- 汎用的な埋め込み方法は 2 つある。
  - 暗黙的レンダリング: `https://challenges.cloudflare.com/turnstile/v0/api.js` を読み込み、`cf-turnstile` クラスの要素を置く。フォーム内なら `cf-turnstile-response` という hidden input が自動で追加される。
  - 明示的レンダリング: `?render=explicit` を付けて読み込み、`turnstile.render()` で描画する。動的コンテンツや SPA 向け。
- `turnstile.reset(widgetId)` で再取得できる。`api.js` は記載された正確な URL から取得する必要があり、プロキシやキャッシュは不可。
- 出典: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- Next.js 専用の公式ガイドページは、今回の検索では見つからなかった。Next.js に言及している公式情報は **Turnstile Spin** だけ。
  - Turnstile Spin は、ウィジェット作成から siteverify の組み込みまでを行うセットアップフロー（ダッシュボード / Wrangler / AI コーディングエージェント）。
  - Next.js（App Router / Pages Router）向けのスニペットを同梱している。
  - 2026-08-10 に GA（一般提供）になった。
  - 出典: https://developers.cloudflare.com/turnstile/spin/ 、https://developers.cloudflare.com/changelog/post/2026-08-10-turnstile-spin-ga/
- Spin の利用料金はページに書かれていない（**未確認**）。
- `@marsidev/react-turnstile` などのコミュニティ製 React ラッパーは一次情報ではないため、評価していない。

---

## 2. API Gateway HTTP API のスロットリング

### 2.1 仕組み

- トークンバケット方式で、上限は「保証された上限ではなく目標値（best-effort）」とされている。超過すると `429 Too Many Requests` が返る。
- 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html

### 2.2 ステージ / ルート単位の設定

- ルート単位のスロットリングで、ステージ全体または個々のルートのレート / バースト上限を設定できる。上限はアカウントレベルを超えられない。
- CLI の例（公式）:

```
aws apigatewayv2 update-stage \
    --api-id a1b2c3d4 \
    --stage-name dev \
    --route-settings '{"GET /pets":{"ThrottlingBurstLimit":100,"ThrottlingRateLimit":2000}}'
```

- 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html

### 2.3 アカウント単位の上限

- アカウント・リージョンごとに、HTTP / REST / WebSocket API の合計で **10,000 RPS**。バーストのバケット容量は **5,000**。
- 一部リージョンではデフォルトが 2,500 RPS / バースト 1,250（ケープタウン、ミラノ、ジャカルタなど）。東京（ap-northeast-1）はこのリストに含まれていない。
- RPS の上限は引き上げを申請できる。バーストは AWS 側が決め、利用者は変更を申請できない。
- 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html

### 2.4 IP 単位の制限

- **HTTP API では IP 単位・クライアント単位のレート制限はできない**。
  - 比較表で、HTTP API は「Per-client rate limiting」「Per-client usage throttling」「API keys」がいずれも No になっている。
  - 「AWS WAF」と「Resource policies」も HTTP API では No。
- 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html

### 2.5 REST API の usage plan との違い

- REST API には、アカウント、ステージ / メソッド単位に加えて「Per-client throttling limits」がある。
- ただし、これは **usage plan に紐づく API キーをクライアント識別子として使う** もので、IP 単位ではない。
- 適用順は次のとおり。
  1. usage plan のクライアント単位・メソッド単位の制限
  2. ステージのメソッド単位の制限
  3. アカウント単位の制限
  4. AWS のリージョン単位の制限
- 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html
- 匿名投稿で API キーをブラウザに配る場合、キーは誰でも取り出せるので、クライアントを識別する手段として有効かは疑わしい。これは**推論であり、一次情報の記述ではない**。

### 2.6 料金・無料枠の関連事項

- HTTP API の料金例は $1.00/100 万リクエスト（リージョンは明記なし）。
- 無料枠は「新規 AWS 顧客」向けに、最長 12 か月、HTTP API の受信 100 万回/月。
- 出典: https://aws.amazon.com/api-gateway/pricing/
- 2025-07-15 以降に作成したアカウントは新しい無料利用枠（クレジット制、Free / Paid プラン）になる。それより前のアカウントは旧プログラム（12 か月トライアルを含む）のまま。
- 出典: https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/
- 新プログラムのサーバーレス向け無料枠ページでは、API Gateway は「クレジットで利用する」と書かれており、Always Free の数値は示されていない。
- 出典: https://aws.amazon.com/free/serverless/
- **スロットリングで 429 になったリクエストが課金されるかは、料金ページに記載がなく未確認。**

---

## 3. AWS WAF

### 3.1 料金体系（USD）

| 項目 | 料金 |
|---|---|
| Web ACL | $5.00/月（時間按分） |
| ルール / ルールグループ / マネージドルールグループ | $1.00/月（1 件ごと） |
| リクエスト | $0.60/100 万リクエスト |
| WCU 超過（既定 1500 を超える 500 WCU ごと） | +$0.20/100 万リクエスト |
| CAPTCHA 試行 | $0.40/1,000 回 |
| Bot Control | $10/月/Web ACL ＋ 超過分の従量課金（Common は月 1,000 万リクエストまで無料） |

- WAF 本体（Web ACL・ルール）の無料枠は料金ページに書かれていない。
- 出典: https://aws.amazon.com/waf/pricing/
- 例として、Web ACL 1 個とレートベースルール 1 個の構成なら、少なくとも月 $6 の固定費になる（上の表からの計算）。

### 3.2 HTTP API に直接アタッチできるか

- **できない**。WAF で保護できるリージョンリソースは次のとおりで、API Gateway は **REST API のみ**。
  - API Gateway REST API
  - ALB
  - AppSync
  - Cognito user pool
  - App Runner
  - Bedrock AgentCore Gateway
  - Verified Access
  - Amplify
- 出典: https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html 、https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
- HTTP API を WAF で守るには、WAF を付けた CloudFront ディストリビューションを前段に置く構成になる。CloudFront の Web ACL は us-east-1 で作成する（同上）。

### 3.3 レートベースルールの仕様

- 評価ウィンドウは 60 / 120 / 300（既定）/ 600 秒から選ぶ。レート上限の最小値は 10。上限を厳密に守る保証はない。
- 集約キーを「IP address in header」にすると、指定したヘッダー（例: `X-Forwarded-For`）の先頭の IP で集約する。
- 出典: https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-high-level-settings.html

### 3.4 CloudFront 定額制 Free プラン（固定費 $0 で WAF を使う経路）

- CloudFront の定額料金プランの **Free プランは $0/月**。内容は WAF ルール 5 個、100 万リクエスト/月、100GB/月。
- どのプランでも超過料金はかからない。WAF でブロックしたリクエストや DDoS は使用量にカウントされない。
- 出典: https://aws.amazon.com/cloudfront/pricing/
- 機能表では Free プランも「**IP-based rate limiting**（5 分あたりのリクエスト数で IP をブロック）」に対応している。
- プランの料金には「Web ACL、カスタムルール、AWS Managed Rules、Web ACL のリクエスト料金」が含まれる。
- 使用量の上限は「hard limits」ではない。継続して大きく超えると配信が調整される場合がある。
- 制約:
  - Free プランは 1 アカウント 3 つまで
  - Web ACL の関連付けが必須
  - Rule Groups は使えない
- 出典: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html
- **重要な制約: 公式は "AWS accounts are not eligible for pricing plans if ... Your account is using AWS Free Tier." と書いている（同上）。**
  - この「AWS Free Tier を使用中」が何を指すのかは**未確認**。新プログラムの Free account plan を指すのか、旧プログラムで 12 か月無料枠の期間中であることも含むのかが分からない。
  - 自分のアカウントが対象になるかは、CloudFront コンソールで確認する必要がある。
- CloudFront の従量課金（Pay-as-you-go）の Always Free は、1TB/月の転送と 1,000 万リクエスト/月。ただし従量課金で WAF を付けると、3.1 の WAF 料金が別にかかる。
- 出典: https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/

### 3.5 CloudFront を前段に置く場合の付随事項

- HTTP API のデフォルトの `execute-api` エンドポイントは無効にできる（`aws apigatewayv2 update-api --disable-execute-api-endpoint`）。
  - ただしこれは「カスタムドメイン経由でしかアクセスできないようにする」機能で、CloudFront 経由だけに絞る機能ではない。
  - 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-disable-default-endpoint.html
- HTTP API はリソースポリシーに対応していない（2.4 の比較表）。
- CloudFront 以外からの直接アクセスを API Gateway の機能だけで遮断する公式手段は、今回の調査では**見つからなかった（未確認）**。
- CloudFront は、オリジンリクエストポリシーを設定すると `CloudFront-Viewer-Address`（閲覧者の IP:ポート）をオリジンに付与できる。
  - 出典: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-cloudfront-headers.html
- CloudFront 経由のとき HTTP API の `sourceIp` に何が入るか（CloudFront のエッジの IP になるか）は、今回の一次情報では**未確認**。

---

## 4. Lambda 側で IP 単位の流量制限を実装する場合

### 4.1 クライアント IP の取得

- HTTP API の payload format 2.0 では `requestContext.http.sourceIp` に IP が入る。`requestContext.http.userAgent` もある。
- 1.0 では `requestContext.identity.sourceIp` に入る。
- 2.0 では重複ヘッダーがカンマで結合され、ヘッダー名はすべて小文字になる。
- 出典: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
- 補足: Go の `aws-lambda-go` では `events.APIGatewayV2HTTPRequest` の `RequestContext.HTTP.SourceIP` が該当すると考えられる。ただしライブラリのソースは今回確認しておらず、**未確認**。

### 4.2 カウンタの保存先と無料枠

| 選択肢 | 無料枠（一次情報） | 実装上の関連仕様 |
|---|---|---|
| Supabase（Postgres）にカウンタ / 投稿履歴を持つ | Free プランは DB 500MB、アクティブなプロジェクト 2 つまで。**1 週間操作がないと一時停止される**。<br>出典: https://supabase.com/pricing | 投稿テーブルに IP（またはハッシュ）と作成時刻を持たせ、直近 N 分の件数を数える方式が考えられる（一次情報なし・一般的な手法）。既存 DB を使うので AWS の追加リソースは不要 |
| DynamoDB にカウンタを持ち TTL で自動削除 | **Always Free**（Free / Paid 両プラン）で 25GB、25 WCU、25 RCU。プロビジョンドモードかつ Standard テーブルクラスが前提。オンデマンドの無料枠の記載はない。<br>出典: https://aws.amazon.com/free/database/ 、https://aws.amazon.com/dynamodb/pricing/ | TTL 属性は Unix エポック秒の Number 型。期限切れアイテムは**数日以内**に削除され、**書き込みスループットを消費しない**。削除されるまでは読める可能性があるため、Query / Scan ではフィルタ式で除外することが推奨されている。<br>出典: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html |
| Lambda の予約済み同時実行数で上限を設ける（IP 単位ではない） | 予約済み同時実行数の設定に追加料金はかからない。Lambda 自体は Always Free で 100 万リクエスト/月、40 万 GB 秒/月。<br>出典: https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html 、https://aws.amazon.com/free/serverless/ | 関数全体の同時実行の上限であり、IP 単位の制限ではない。予約できるのは「未予約のアカウント同時実行数 − 100」までなので、アカウントの同時実行上限が低い場合は設定できない可能性がある（新規アカウントのデフォルト値は**未確認**） |
| Vercel WAF Rate Limiting（Next.js 側を経由する場合のみ） | 全プランで使える。Hobby はルール 1 件/プロジェクト、許可リクエスト 100 万件込み。キーは IP と JA4 Digest、固定ウィンドウは 10 秒〜10 分。<br>出典: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting | Vercel 上のリクエストが対象。ブラウザから API Gateway を直接呼ぶ構成では、API への流量制限にはならない（構成から言えること） |

- TTL の削除は数日遅れることがあるので、DynamoDB でウィンドウを判定するにはアプリ側で期限切れを除外する必要がある（上記 TTL の仕様から言えること）。

---

## 5. その他の一般的な手法（補足）

- **ハニーポットフィールド**（人には見えない入力欄に値が入っていたら拒否する）、**同一 IP からの投稿間隔の制限**、**投稿内容の長さや URL 数の制限** は一般的な手法。ただし、標準化された仕様や公式ドキュメントといった一次情報は今回見つからなかった（**未確認**）。
- Turnstile のトークンは 1 回しか使えないので、同じトークンを使い回した連投は siteverify で弾ける（1.3 の仕様から言えること）。トークンを毎回新しく取得する自動化への耐性は、Turnstile のチャレンジの強さに依存する。
- Vercel のナレッジベースにはハニーポットの記事がある（https://vercel.com/kb/guide/how-to-build-a-honeypot-with-vercel-web-application-firewall ）。ただしこれは robots.txt を無視するボットをパスで捕まえる手法で、フォームの隠しフィールドとは別物。

---

## 設計判断への示唆（事実から言えること）

1. **API Gateway HTTP API だけでは IP 単位の制限はできない。** ステージ / ルート単位の制限は API 全体のレートの上限になり、Lambda や DB の過剰な呼び出しを抑える効果はある。ただし、特定の荒らしだけを止めることはできない（2.2・2.4）。
2. **AWS WAF を HTTP API に直接付けることはできない。** 選択肢は次の 3 つで、いずれも固定費の観点で条件が付く（3.1〜3.4）。
   - REST API に移行して WAF を付ける（Web ACL $5/月〜）
   - CloudFront（従量課金）＋ WAF（同じく $5/月〜）
   - CloudFront 定額の Free プラン（$0）。アカウントが「AWS Free Tier を使用中」でないことが条件で、この条件の解釈は**未確認**
3. **Turnstile は追加の固定費なしで導入でき、DNS の移行も不要。** トークンは 300 秒有効・1 回限りの検証なので、siteverify は投稿 API（Go Lambda）側で 1 回だけ呼ぶ必要がある。フロントで再試行するときは `turnstile.reset` で新しいトークンを取得する（1.2・1.3・1.5）。
4. **IP 単位の制限は Lambda 内で実装するのが追加固定費のない現実的な経路になる。** 保存先は 2 つ考えられる（4.1・4.2）。
   - 既存の Supabase: AWS リソースは増えないが、Free プランの一時停止がある
   - DynamoDB: Always Free・TTL あり。プロビジョンドモードが無料枠の前提
5. **CloudFront を前段に置く場合は、IP 取得元と直接アクセスへの対策を別途検討する必要がある。** IP の取得元が変わる可能性があり（`sourceIp` か `CloudFront-Viewer-Address` か、**未確認**）、`execute-api` への直接アクセスを API Gateway 側だけで遮断する公式手段も見つかっていない（3.5）。
6. **Lambda の予約済み同時実行数は無料で使える。** IP 単位ではないが、攻撃を受けたときにコストが膨らまないよう全体に上限をかける手段になる（4.2）。
7. **429 になったリクエストが API Gateway で課金されるかは未確認。** 「月数十円」の目標に対して攻撃時の最悪ケースを見積もるには、この点の確認が必要（2.6）。
