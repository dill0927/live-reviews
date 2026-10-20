# 画像パイプライン調査（SEKI-REPO リプレイス）

- 調査日: 2026-10-19
- 前提: Next.js 15（Vercel Hobby）/ Go on AWS Lambda（provided.al2023, VPC 外）/ API Gateway HTTP API / S3（プライベート）/ CloudFront（OAC）/ Supabase
- 根拠: 一次情報（AWS・Vercel・Next.js の公式ドキュメント、公式料金ページ、AWS Price List API、ソースコード）のみ。確認できなかった点は「未確認」と書いている。

## 要約

1. アップロードは presigned POST（POST policy）を使えば、`content-length-range` によるサイズ上限と `Content-Type` の前方一致をサーバー側（S3）で強制できます。aws-sdk-go-v2 は v1.61.0（2024-08-28）から `PresignPostObject` に公式対応しています。配信は CloudFront + OAC が推奨構成で、OAI は公式に「legacy, not recommended」とされています。
2. 小規模（月に画像数百枚・閲覧数万回）なら、CloudFront の Always Free（月 1TB・1,000 万リクエスト）、S3 数十円、Lambda は無料枠内か 1 円未満に収まる見込みです。固定費が出るのは、ECS 版の公式画像変換ソリューション（ALB/Fargate 常時稼働）と CloudFront 定額制の有料プランです。Lambda@Edge には無料枠がなく、Go も使えません（Node.js/Python のみ）。
3. Vercel Hobby の Image Optimization は「月 5K 変換・30 万キャッシュ読み取り・10 万キャッシュ書き込み」の上限付きで無料です。上限を超えると新しい画像が 402 エラーになります。また Hobby は非商用の個人利用に限られています。アップロード時に Lambda で派生画像を事前生成する方式なら、Go でも cgo なしで WebP/AVIF をエンコードできるライブラリがあります（性能は未確認）。

---

## 1. S3 署名付き URL（PUT と presigned POST）

### 1.1 違い

| 項目 | presigned PUT | presigned POST（POST policy） |
| --- | --- | --- |
| 方式 | URL に署名を付け、HTTP PUT で本文を送る | 署名済みの policy をフォームに入れ、multipart/form-data の POST で送る |
| ファイルサイズ上限の強制 | 調べた公式ページには、範囲（最小〜最大）を強制する仕組みの記述がなかった（**未確認**） | `["content-length-range", min, max]` で最小・最大バイト数を強制できる |
| Content-Type の強制 | 発行時に ContentType を指定すると、アップロード時に同じ Content-Type を送る必要がある（違うと `SignatureDoesNotMatch`） | `Content-Type` に完全一致か `starts-with` の条件を付けられる（例: `["starts-with", "$Content-Type", "image/"]`） |
| キーの制約 | URL ごとにキーが 1 つに固定される | `key` の完全一致または `starts-with` で制約できる |
| 同じキーへの再アップロード | 既存オブジェクトを置き換える | 同様（policy の条件の範囲内で） |

出典:
- PUT と Content-Type の一致: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- POST policy の条件（`content-length-range` の範囲指定、`Content-Type` の完全一致と `starts-with`、フォームに含める各フィールドは条件に列挙が必要）: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
  - 注: 調査時点ではこのページを直接取得できず（取得すると Welcome ページへのリダイレクト HTML が返った）、内容は公式ページの検索インデックス抜粋で確認した。条件の書式は、下記の Go SDK ソースのコメントにあるリンク先とも一致する。
- 補足: `Content-Type` はクライアントが申告する値です。S3 がファイルの実際のバイト列を検査すると書いた公式記述は見つかりませんでした（**未確認**）。

### 1.2 有効期限の上限

- コンソールで発行する場合は 1 分〜12 時間、CLI/SDK では最大 7 日（SigV4、IAM ユーザーの認証情報を使う場合）。
- 一時的な認証情報（IAM ロールや STS）で発行した URL は、指定した期限より前でも、認証情報が失効した時点で無効になる。Lambda の実行ロールで発行する URL はこれに当たる。
- 期限のチェックはリクエストの開始時に行われる。
- バケットポリシーの `s3:signatureAge` 条件で、署名から一定時間を超えた presigned リクエストを拒否できる。

出典: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html

POST policy の `expiration` は ISO 8601 形式の日時で指定する（同上の POST Policy ページ）。Go SDK はデフォルトで 15 分です（下記ソース参照）。

### 1.3 ブラウザから直接アップロードする場合の CORS

- バケットの CORS 設定で `AllowedOrigins`（オリジン）、`AllowedMethods`（GET/PUT/POST/DELETE/HEAD）、`AllowedHeaders`（プリフライトで許可するヘッダー）、`ExposeHeaders`、`MaxAgeSeconds` を指定する。ルールは最大 100 個で、S3 コンソールでは JSON で設定する。
- 公式の設定例: `AllowedMethods: ["PUT","POST","DELETE"]` と `AllowedOrigins: ["http://www.example.com"]`、`ExposeHeaders` に `x-amz-request-id` などを指定し、`MaxAgeSeconds: 3000`。
- CORS を有効にしても、ACL やバケットポリシーは引き続き適用される。

出典:
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html

### 1.4 Go（aws-sdk-go-v2）での発行

- `s3.PresignClient` に `PresignPutObject` と `PresignPostObject` がある（pkg.go.dev で確認したのは v1.114.3、2026-10-09 公開）。https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/service/s3
- presigned POST は `service/s3` の **v1.61.0（2024-08-28）** で追加された（CHANGELOG: "Feature: Add presignPost for s3 PutObject"）。https://github.com/aws/aws-sdk-go-v2/blob/main/service/s3/CHANGELOG.md
- `PresignPostOptions` の内容（ソース: https://github.com/aws/aws-sdk-go-v2/blob/main/service/s3/presign_post.go）
  - `Expires time.Duration`: 未設定か 0 なら 900 秒（`defaultExpiresIn = 15 * time.Minute`）。
  - `Conditions []any`: policy に追加する条件。`content-length-range` などはここで指定する。
  - SDK は `x-amz-algorithm`、`bucket`、`x-amz-credential`、`x-amz-date`（一時的な認証情報を使う場合はセキュリティトークンも）を自動で条件に入れる。利用者が key の条件を指定しなければ `{"key": <指定キー>}` の完全一致を自動で追加する。
  - 戻り値の `PresignedPostRequest` は、`URL` とフォームの `Values` を持つ。

## 2. CloudFront + OAC

### 2.1 S3 をプライベートにしたまま配信する設定

1. OAC を作る（推奨設定は "Sign requests"、API では `SigningBehavior: always`）。この設定のとき、CloudFront と S3 の間は常に HTTPS になる。
2. ディストリビューションの S3 オリジンに OAC を設定する。
3. バケットポリシーで `Principal: {"Service": "cloudfront.amazonaws.com"}` に `s3:GetObject` を許可し、`Condition` の `AWS:SourceArn` で対象ディストリビューションに限定する。
4. Object Ownership は "Bucket owner enforced"（新規バケットのデフォルト）にする。S3 のウェブサイトエンドポイントは OAC では使えない。

出典: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

### 2.2 OAI との違い

- 公式ページで OAI は「Use an origin access identity (legacy, not recommended)」と書かれている。
- OAC だけが対応しているもの: 全リージョンの S3（2022 年 12 月以降のオプトインリージョンを含む）、SSE-KMS、動的リクエスト（PUT/DELETE）。OAI はこれらに対応していないか、回避策が必要。
- CloudFront 定額制プランでは OAI は非対応機能に挙がっており、OAC を使うよう案内されている。

出典:
- 上記 private-content-restricting-access-to-s3.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html

### 2.3 無料枠（従量課金の Always Free）

| 項目 | 月あたりの無料枠 |
| --- | --- |
| インターネットへのデータ転送 | 1 TB |
| HTTP/HTTPS リクエスト | 10,000,000 |
| CloudFront Functions の呼び出し | 2,000,000 |
| KeyValueStore の読み取り | 2,000,000 |

- 無料枠を超えた分（第 1 段階）: 転送は米国 $0.085/GB、日本 $0.114/GB。HTTPS リクエストは 1 万件あたり米国 $0.0100、日本 $0.0120。
- S3 から CloudFront へのデータ転送は課金されない（https://aws.amazon.com/s3/pricing/）。

出典: https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/

### 2.4 CloudFront 定額制プラン（flat-rate pricing plans）

| プラン | 月額（ディストリビューションごと） | リクエスト | 転送量 | WAF ルール | S3 Standard クレジット |
| --- | --- | --- | --- | --- | --- |
| Free | $0 | 100 万 | 100 GB | 5 | 5 GB |
| Pro | $15 | 1,000 万 | 50 TB | 25 | 50 GB |
| Business | $200 | 1.25 億 | 50 TB | 50 | 1 TB |
| Premium | $1,000 | 5 億（最大 60 億まで変更可） | 50 TB（最大 600 TB まで変更可） | 75 | 5 TB |

- 超過料金はない。使用量の目安（allowance）はハードリミットではない。初回のスパイクは月の目安の 3 倍まで影響がない。目安を大きく超える状態が 2〜3 か月以上続くと、配信が調整されることがある（遠いエッジから配信されるなど）。
- 料金に含まれるもの: ディストリビューション本体、WAF の Web ACL・ルール・リクエスト料金、標準ログの CloudWatch Logs 取り込み、Route 53 のホストゾーンと DNS クエリ（プランに紐付けた場合）、ACM の TLS 証明書。
- 料金に含まれないもの: **Lambda@Edge の呼び出しは従量課金**。CloudFront Functions はプランの「Serverless edge compute」に含まれる。
- 加入条件・制約:
  - Free プランは 1 アカウントあたり 3 つまで。プランは全体で 100 まで。いずれも引き上げ不可。
  - 1 プランでカバーされるのは 1 ディストリビューションと 1 つの apex ドメイン。
  - **WAF の Web ACL の関連付けが必須**。
  - **「Your account is using AWS Free Tier」のアカウントは対象外**。この「Free Tier」が、2025 年以降の新しい Free プラン（クレジット制）のアカウントだけを指すのか、従来の 12 か月無料枠を使用中のアカウントも含むのかは、公式記述から判断できない（**未確認**）。
  - OAI、レガシーのキャッシュ設定（ForwardedValues）、リアルタイムログなどは非対応。
- Free プランとは別に、従量課金の Always Free（1TB / 1,000 万リクエスト）も引き続き適用される旨が CloudFront FAQ（https://aws.amazon.com/cloudfront/faqs/）にあると検索結果では示されたが、ページ本文は直接確認していない（**未確認**）。

出典:
- https://aws.amazon.com/cloudfront/pricing/
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html

### 2.5 独自ドメインと ACM 証明書

- ビューアーと CloudFront の間で ACM 証明書を使うには、**US East (N. Virginia)（us-east-1）でリクエスト（またはインポート）する必要がある**。
- 代替ドメイン名（CNAME）は、証明書の SAN に完全一致するか、同じ階層のワイルドカードで含まれている必要がある。
- ACM が発行した証明書は ACM が自動更新する。

出典: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html

ACM のパブリック証明書が単体で無料かどうかは、今回 ACM の料金ページを確認していない（**未確認**）。定額制プランには「Free TLS certificate」が含まれると明記されている（flat-rate-pricing-plan.html）。

## 3. 画像の変換・最適化をどこでやるか

### 3a. Next.js `<Image />` を Vercel で使う（Vercel Image Optimization）

- **Hobby の上限（月）**: 画像変換 5K、キャッシュ読み取り 30 万、キャッシュ書き込み 10 万。
- **従量課金単価（Pro 以上）**:
  - 変換: 1K あたり $0.05〜$0.0812
  - キャッシュ読み取り: 100 万あたり $0.40〜$0.64
  - キャッシュ書き込み: 100 万あたり $4.00〜$6.40
- 課金の単位:
  - 変換は、キャッシュの MISS か STALE のたびに 1 回課金される。
  - キャッシュの読み取り・書き込みは 8KB 単位で数える。読み取りは、共有のグローバルキャッシュから取り出したときだけ課金される（同じリージョンで最近アクセスされた画像は課金されない）。
  - 配信時には別途 Fast Data Transfer と CDN Requests がかかる。
- **Hobby で上限を超えた場合**: 料金はかからないが、新しい画像の最適化に失敗して 402 が返る（`onError` が呼ばれ、`alt` テキストが表示される）。すでにキャッシュされた画像は引き続き表示される。
- **Hobby は非商用の個人利用に限られる**（Fair Use Policy への言及）。
- 制約: 変換後の画像は最大 10MB。元画像は 8192px 以内。最適化の対象は jpeg/png/webp/avif のみ。
- 現在の課金体系は「変換・読み取り・書き込み」の 3 項目で、元画像の枚数で課金する方式は legacy です（ページの最終更新は 2026-08-11）。

出典: https://vercel.com/docs/image-optimization/limits-and-pricing

**remotePatterns で CloudFront ドメインを許可する（Next.js 15 のドキュメント）**

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [new URL('https://img.example.com/reports/**')], // v15.3.0 以降
    // またはオブジェクト形式
    // remotePatterns: [{ protocol: 'https', hostname: 'img.example.com', port: '', pathname: '/reports/**', search: '' }],
  },
}
```

- 一致しない URL には 400 が返る。`protocol`、`port`、`pathname`、`search` を省略すると `**` 扱いになり、意図しない URL まで最適化される恐れがあるため推奨されない。
- `domains` は Next.js 14 から非推奨。
- `formats` のデフォルトは `['image/webp']`。AVIF を有効にすると、エンコードは WebP より約 50% 遅く、サイズは約 20% 小さくなる（公式の記載）。
- `minimumCacheTTL` のデフォルトは 60 秒。元画像の `Cache-Control` と比べて大きい方が使われる。

出典: https://nextjs.org/docs/15/app/api-reference/components/image

### 3b. custom loader で CloudFront 側に任せる

- `images.loader: 'custom'` と `images.loaderFile` を設定するか、`loader` prop を渡す。loader は `({ src, width, quality }) => string` の形で、URL 文字列を返す関数。
- loader を使うと、Next.js（Vercel）の最適化サーバーを通らず、loader が返す URL をブラウザが直接取得する。そのため、CloudFront 側で幅（`width`）に対応する画像を返せる必要がある。返す方法は次のどちらか。
  - (i) 3c の動的変換サービス
  - (ii) 3d で事前生成した派生画像のうち、`width` に近いものを選んで返す URL を組み立てる
- `unoptimized` を使う方法もある。

出典: https://nextjs.org/docs/15/app/api-reference/components/image（`loader`、`loaderFile` の節）

### 3c. CloudFront Functions / Lambda@Edge / AWS 公式ソリューション

**CloudFront Functions**: 画像の変換には使えない。

- JavaScript のみ。関数サイズは最大 10KB、メモリは 2MB。ネットワーク、ファイルシステム、リクエスト本文にはアクセスできない。イベントは viewer request と viewer response のみ。
- 用途として公式に挙がっているのは、キャッシュキーの正規化、ヘッダー操作、URL の書き換え、JWT などの検証。例えば Accept ヘッダーを見て、事前生成した `.avif` や `.webp` に URL を書き換える用途には使える。
- 料金は 100 万回あたり $0.10 で、Always Free が月 200 万回ある。

出典:
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-functions-choosing.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html
- https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/

**Lambda@Edge**:

- 料金: リクエスト 100 万件あたり $0.60、実行時間は 1GB 秒あたり $0.00005001。「**There is no free tier for Lambda@Edge at this time**」と明記されている。
- ランタイムは Node.js と Python のみ（**Go や provided 系は使えない**）。
- 関数は us-east-1 に作る必要がある。arm64、環境変数、レイヤー、VPC、コンテナイメージ、512MB を超えるエフェメラルストレージは使えない。
- 関数が生成するレスポンス（ヘッダーと本文を含む）のサイズ上限: viewer イベントで 40KB、origin イベントで 1MB。メモリは viewer イベントで 128MB、origin イベントで最大 10,240MB。タイムアウトは 30 秒。
- 定額制プランに加入していても従量課金になる。

出典:
- https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html

**Dynamic Image Transformation for Amazon CloudFront（AWS 公式ソリューション）**: 構成が 2 種類ある。

- **Lambda 構成**:
  - 構成: CloudFront → API Gateway → Lambda（`sharp` で変換）→ 既存の S3。ログ用の S3 バケットが別途作られる。署名検証（任意）では Secrets Manager、スマートクロップ（任意）では Rekognition を使う。
  - 扱える画像は 6MB まで。
  - 注意: 「publicly accessible, unauthenticated CloudFront distribution and API Gateway endpoint」が作られる。URL 署名機能を使えば、不正なリクエストを制限できる。
- **ECS 構成**:
  - 構成: ALB と ECS on Fargate が常時稼働し、DynamoDB、Amplify の管理 UI、Cognito も使う。
  - 公式のコスト試算でも、常時稼働のインフラがあるためベースのコストが高いとされている。
- 公式のコスト試算（定額制プランを前提とした値）: Lambda 構成で月 1,000 万画像のとき合計 $203.48（うち CloudFront の Business プランが $200）。API Gateway、Lambda、S3、CloudWatch はそれぞれ数ドル。デフォルトは CloudFront の従量課金。
- Lambda 構成で月数千回程度の変換なら、固定費が出る要素は見当たらない。ただし、Secrets Manager のシークレット料金、CloudWatch のダッシュボードとログの料金、API Gateway（REST）の無料枠の扱いは、今回確定していない（**未確認**）。

出典:
- https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/architecture-overview.html
- https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/lambda-architecture.html
- https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/ecs-architecture.html
- https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/lambda-architecture-costs.html
- https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/cost.html

### 3d. アップロード時に S3 イベント → Lambda で事前生成

- AWS 公式チュートリアルにある構成: S3 の `s3:ObjectCreated:Put` イベントで Lambda を非同期に起動し、サムネイルを作って別バケットに置く。チュートリアルの実装は Node.js（sharp）と Python（Pillow）。
- **同じバケットに書き込むと Lambda が無限ループで呼ばれる恐れがある**ため、バケットを 2 つに分けるか、トリガーを入力用のプレフィックスに限定することが推奨されている。
- 出典:
  - https://docs.aws.amazon.com/lambda/latest/dg/with-s3-tutorial.html
  - https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html

**Go で WebP/AVIF をエンコードする選択肢**

| 選択肢 | エンコード | cgo | 備考 | 出典 |
| --- | --- | --- | --- | --- |
| `golang.org/x/image/webp` | 不可（デコードのみ） | 不要 | "implements a decoder for WEBP images" | https://pkg.go.dev/golang.org/x/image/webp |
| `github.com/gen2brain/webp` | 可 | 不要 | libwebp を WASM にして wasm2go で純 Go に変換したもの。システムに共有ライブラリがあれば purego 経由で使い、なければ純 Go 版を使う（`nodynamic` タグで純 Go 版に固定）。性能の公式数値はなし | https://github.com/gen2brain/webp |
| `github.com/gen2brain/avif` | 可（aom を使用） | 不要 | libavif を WASM にして wazero で実行（`wasm2go` タグなら純 Go に変換）。共有ライブラリがあれば purego で使う。性能やメモリの公式数値はなし | https://github.com/gen2brain/avif |
| `github.com/chai2010/webp` | 可 | 必要（libwebp の C ソースを同梱。GCC が必要） | README に「メンテナンスされていない」とある | https://github.com/chai2010/webp |

- provided.al2023 での制約: AWS の手順では `CGO_ENABLED=0` でビルドする例が示されており、libc のバージョン差に左右されない安定したバイナリになると説明されている。cgo を使う場合は、Lambda の libc と互換のある環境でビルドする必要がある。具体的な手順は**未確認**。
- arm64 と x86_64 の両方が使える。zip パッケージは展開後 250MB まで。
- 出典: https://docs.aws.amazon.com/lambda/latest/dg/golang-package.html
- WASM 版のエンコード速度とメモリ使用量（Lambda で何秒・何 MB かかるか）は、公式のベンチマークが見つからなかった（**未確認**。実測が必要）。

## 4. 無料枠と小規模での概算コスト

### 4.1 前提にした単価（東京リージョン。AWS Price List API、2026-10 時点の公開データ）

| 項目 | 単価 | 出典 |
| --- | --- | --- |
| S3 Standard ストレージ | $0.025/GB 月（最初の 50TB） | https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-northeast-1/index.json |
| S3 PUT/COPY/POST/LIST | 1,000 件あたり $0.0047 | 同上 |
| S3 GET など | 10,000 件あたり $0.0037 | 同上 |
| Lambda（arm64） | $0.0000133334/GB 秒、リクエスト 100 万件あたり $0.20 | https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/ap-northeast-1/index.json |
| Lambda 無料枠 | 月 100 万リクエスト + 40 万 GB 秒 | https://aws.amazon.com/lambda/pricing/ |
| API Gateway HTTP API | 100 万件あたり $1.00（料金ページの例示。リージョンは明記なし）。無料枠は REST と HTTP それぞれ月 100 万件（最大 12 か月） | https://aws.amazon.com/api-gateway/pricing/ |
| CloudFront | 2.3 節を参照 | |

- 2025 年以降の新規アカウントは、Free プラン（最大 $200 のクレジット、6 か月）と Paid プランに分かれている。「30 以上のサービスが Free/Paid 両プランで Always Free」とされているが、Always Free の対象サービスの一覧と量は、今回取得したページには載っていなかった。
- そのため、Lambda の無料枠が Always Free かどうか、S3 の旧 12 か月無料枠（5GB など）が今のアカウントに適用されるかは**未確認**。
- 出典: https://aws.amazon.com/free/ 、 https://aws.amazon.com/free/free-tier-faqs/

### 4.2 試算の前提（仮定）

- アップロード: 月 300 枚。元画像は平均 3MB の JPEG。
- 派生画像: 表示用（約 1600px）の WebP 約 300KB と、サムネイル（約 400px）約 40KB の 2 種類。
- 閲覧: 月 3 万ページビュー。サムネイル表示 12 万回、表示用画像 1 万回。転送量は約 7.8GB、リクエストは約 13 万件。

### 4.3 案ごとの概算（月額、USD。12 か月分の画像が蓄積した時点）

| 項目 | A: Vercel `<Image />` で最適化 | B: custom loader + 事前生成（= D の配信形態） | C1: Lambda@Edge で動的変換 | C2: 公式ソリューション（Lambda 構成） | D: S3 イベント → Go Lambda で事前生成 |
| --- | --- | --- | --- | --- | --- |
| CloudFront 転送・リクエスト | Always Free 内で $0（Vercel が元画像を取得するのはキャッシュミス時のみ） | Always Free 内で $0 | Always Free 内で $0 | Always Free 内で $0（従量課金の場合） | Always Free 内で $0 |
| S3 ストレージ | 元画像のみで約 10.8GB、約 $0.27 | 元画像 + 派生で約 12GB、約 $0.30（変換後に元画像を消せば約 $0.03） | 約 $0.27 + 変換結果の保存先次第 | 約 $0.27 + ログ用バケット | B と同じ |
| S3 リクエスト | 数セント未満 | PUT 900 件で約 $0.004、GET は最大でも約 $0.05 | 数セント未満 | 数セント未満 | B と同じ |
| 変換の計算 | Vercel: 300 枚 × 数種類の幅で月 1,000〜2,000 回程度。Hobby の 5K 以内の見込み | Lambda 300 回。仮に 1.75GB × 5 秒なら約 2,600GB 秒で無料枠内（枠がなくても約 $0.035） | 無料枠なし。変換回数 × ($0.0000006 + GB 秒 × $0.00005001)。数千回なら数セント | API Gateway（REST）と Lambda。数千回なら数セント（REST の単価は料金ページの例示で 100 万件 $3.50） | B と同じ |
| その他 | Vercel のキャッシュ読み取り（8KB 単位）は、最悪ケースで月 100 万単位近くになり、Hobby の 30 万を超えうる（regional キャッシュがどれだけ効くかは**未確認**）。Fast Data Transfer の Hobby 上限も**未確認** | CloudFront Functions（任意。Always Free 200 万回） | Node.js/Python で書く必要がある（Go 不可） | Secrets Manager（署名を使う場合）と CloudWatch の料金は**未確認** | 同左 |
| 固定費 | なし | なし | なし | Lambda 構成なら、見えている範囲ではなし（ECS 構成は ALB/Fargate の常時費用あり） | なし |
| 概算の合計 | AWS 側 $0.3 前後 + Vercel は上限内なら $0 | **$0.3〜0.4 前後（約 50〜60 円）** | $0.3 + 数セント | $0.3 + 数セント〜（未確認項目あり） | B と同じ |

- 上の数値は 4.2 の仮定に 4.1 の単価を掛けた概算です。実際の画像サイズ、キャッシュヒット率、Vercel の regional キャッシュの効き方で変わります。
- 定額制プランの Free（$0、100 万リクエスト、100GB）を使えば、さらに 5GB 分の S3 Standard クレジットが付き、ストレージ費はほぼ相殺される。ただし、WAF の Web ACL が必須であることと、AWS Free Tier を使用中のアカウントが対象外であること（2.4 節）に注意。

## 5. 補足: EXIF（位置情報）の削除

- **Go 標準の `image/jpeg`（ソースコードで確認）**
  - デコーダーが処理する APP マーカーは APP0（JFIF）と APP14（Adobe）だけで、APP1（EXIF）を含むほかの APPn は読み飛ばす。
  - エンコーダーが書くのは SOI/DQT/SOF0/DHT/SOS/EOI だけで、EXIF は書かない。
  - つまり「デコード → 再エンコード」すると EXIF（GPS を含む）は出力に残らない。一方で、**EXIF の Orientation も反映されない**ので、回転は自前で処理する必要がある。
  - 出典:
    - https://github.com/golang/go/blob/master/src/image/jpeg/reader.go
    - https://github.com/golang/go/blob/master/src/image/jpeg/writer.go
- **sharp**（Node.js。公式画像変換ソリューションと Lambda チュートリアルで使われている）: 「By default all metadata will be removed, which includes EXIF-based orientation.」 https://sharp.pixelplumbing.com/api-output/
- **Vercel Image Optimization**: 出力からメタデータが消えるかどうかの公式記述は見つからなかった（**未確認**）。
- **S3 に保存した元画像**: 元画像そのものには EXIF が残る。元画像を CloudFront 経由で公開する構成（例えば A 案で、Vercel が取得できるように元画像の URL を公開する場合）では、元画像の EXIF も取得できる状態になる。これは構成から言える帰結で、特定の公式記述に基づくものではない。

---

## 設計判断への示唆（事実から言えること。判断はしない）

- 「サイズ上限と画像 MIME の強制を S3 側で行いたい」なら、公式に条件として用意されているのは presigned POST の `content-length-range` と `Content-Type` の `starts-with` です。Go SDK は v1.61.0 以降で `PresignPostObject` に対応しています。PUT でサイズの範囲を強制する方法は、今回確認したドキュメントにはありませんでした。
- presigned URL を Lambda の実行ロールで発行すると、有効期限はロールのセッションに縛られます。短い期限（POST の Go SDK デフォルトは 15 分）で運用する前提と矛盾しません。
- ブラウザから直接アップロードするなら、S3 の CORS で、Vercel のオリジンと POST（または PUT）を許可する必要があります。
- OAI は legacy で、定額制プランでも非対応です。新しく作るなら OAC 以外を選ぶ理由は公式記述からは見当たりません。
- ACM 証明書は us-east-1 で作る必要があります。Lambda や API Gateway を東京リージョンに置く場合でも、証明書だけは別リージョンになります。
- Lambda@Edge は Go が使えず無料枠もないため、Go に統一したいことと無料枠を優先したいことの両方に反します。CloudFront Functions は画像の変換には使えず、URL の書き換え（フォーマットの振り分けなど）にとどまります。
- AWS 公式の画像変換ソリューションは、Lambda 構成なら固定費は見えません。ただし、認証なしの公開 API Gateway エンドポイントが作られることと、未確認のコスト項目（Secrets Manager、CloudWatch）があります。ECS 構成は常時稼働の費用が出ます。
- Vercel の `<Image />` は実装の手間が最も少ない一方で、次の点が懸念として残ります。
  - Hobby は非商用に限定されている。
  - 上限を超えると新しい画像が 402 になる（課金はされない）。
  - キャッシュ読み取りの 8KB 単位課金がどれだけ消費されるかが不確定。
  - Vercel が元画像を取得できるよう、元画像を公開 URL に置く必要があり、EXIF を除去していなければ元画像から位置情報が読める。
- アップロード時に事前生成する方式（D）は、次の要素がすべて従量課金で、小規模なら固定費は出ません: S3 イベント、Go Lambda（cgo なしのライブラリあり）、CloudFront の Always Free、custom loader（または `unoptimized`）による幅の選択。再エンコードで EXIF を落とせますが、Orientation は自前で処理する必要があります。WASM 版エンコーダーの Lambda 上での速度とメモリは未確認なので、実測が必要です。
- CloudFront 定額制の Free プランは、規模（100 万リクエスト / 100GB）としては今回の想定に収まります。ただし、WAF が必須であること、AWS Free Tier を使用中のアカウントが対象外であること（その範囲は未確認）、Free プランは 1 アカウント 3 つまでであることを満たす必要があります。従量課金の Always Free（1TB / 1,000 万）でも、想定規模なら $0 です。
