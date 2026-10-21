# SEKI-REPO リプレイス（メタマップ）

Label: wayfinder:map
Status: 完了（2026-10-20）。チケット 14 件はすべて解決済み。次は下の「領域別マップへの引き継ぎ」に沿って、領域別マップを立ち上げる。

## Destination

SEKI-REPO リプレイスについて、領域をまたぐアーキテクチャ判断（ADR）がすべて確定し、領域別マップ（データモデル → バックエンド＋インフラ → フロントエンド → UI/UX → CI/CD・ドキュメント）を、この順番で1つずつ立ち上げられる状態。

## Notes

- これは「マップのマップ」。チケットは領域をまたぐ判断だけを扱い、各領域の詳細は後で立ち上げる領域別マップで詰める。
- 計画のみ。実装はこのマップの外で行う。
- 本番ユーザーはいないため、後方互換は考えなくてよい。ゼロベースで最適、かつポートフォリオとして強い構成を目指す。ただし過度に複雑にはしない。
- 学習も兼ねるので、各判断では「なぜそうするか」を言語化する。
- コスト：AWS は無料枠を最優先する。NAT Gateway・常時起動の ALB・RDS など、固定費がかかるリソースは使わない。
- 用語は [CONTEXT.md](../../CONTEXT.md) に従う（「レビュー」ではなく「座席レポ」）。判断が確定し、ADR の3条件（元に戻しにくい・背景なしでは意外・本物のトレードオフ）を満たすものは `docs/adr/` に ADR として残す。
- セッションごとに `/grilling` と `/domain-modeling` を使う。research チケットは `/research` のサブエージェントで解決する。
- チケットのファイルは `issues/` にある。frontier（今取りかかれるもの）は、`Status: open` で、`Blocked by` のチケットがすべて resolved のもののうち、番号が若い順。
- 決定済みの前提（チャーティング時に確定）：
  - ログイン方法はメールとパスワード、Google、X の 3 つを残す。
  - 座席レポ＝1回の参戦体験の記録。会場評価も含む。
  - 参戦日は任意の日付として持つ。公演はエンティティにしない。
  - 匿名投稿はテキストのみで、画像はログイン必須。（チャーティング時は「編集・削除不可」としていたが、「匿名投稿の不正対策の決定」で、匿名サインインを使って同じブラウザからなら編集・削除できるように変更した）
  - 既存データのうち、会場とアーティストのマスタだけを seed として引き継ぐ。
  - sekirepo.com は使い続ける。

## Decisions so far

<!-- 解決したチケットごとに1行：[チケット名](issues/NN-xxx.md) — 結論の要約 -->

- [AWS アカウントと無料枠の条件の確認](issues/01-aws-account-free-tier.md) — 2024-12 作成の既存アカウントを使う。12 か月無料枠は終了済みで $200 クレジットも対象外。Always Free 以外は従量課金。課金の実績なし、ルートの MFA は設定済み
- [Supabase と AWS の連携方式の調査](issues/02-supabase-aws-integration-research.md) — 無料プランでは IPv4 の Supavisor（transaction mode）経由で接続するしかない。JWT は ES256 の JWKS が既定で、API Gateway の JWT Authorizer とは相性が悪い。無料プランは 7 日間アクセスがないと一時停止する（調査：[docs/research/supabase-aws-integration.md](../../docs/research/supabase-aws-integration.md)）
- [画像パイプラインの調査](issues/07-image-pipeline-research.md) — サイズを強制できるのは presigned POST。配信は OAC。Vercel Hobby の画像最適化は月 5,000 変換が上限、Lambda@Edge は Go 非対応で無料枠もない。どの案でも月 $0.3〜0.4 程度（調査：[docs/research/image-pipeline.md](../../docs/research/image-pipeline.md)）
- [匿名投稿の不正対策の調査](issues/03-anonymous-abuse-prevention-research.md) — 固定費なしで使えるのは Turnstile、ルート単位のスロットリング、Lambda 内での IP 単位の制限、予約済み同時実行数。HTTP API には IP 単位の制限も WAF も直接は付けられない（調査：[docs/research/anonymous-abuse-prevention.md](../../docs/research/anonymous-abuse-prevention.md)）
- [API 契約の管理方式](issues/04-api-contract.md) — REST + OpenAPI をスキーマ先行で書く（`api/openapi.yaml`）。Go は oapi-codegen、TypeScript は openapi-typescript と openapi-fetch で生成し、エラーは RFC 9457 に統一する（ADR 0001）
- [データストアと認証基盤の選定](issues/06-datastore-auth-selection.md) — 認証も DB も Supabase を使い続ける（X ログインに対応しているのが Supabase Auth だけのため）。フロントから直接呼ぶのは認証だけで、一時停止は cron での定期アクセスで防ぐ（ADR 0002）
- [ドメインと DNS の構成](issues/05-domain-dns.md) — フロントは www.sekirepo.com、API は api.sekirepo.com、画像は img.sekirepo.com。DNS はお名前.com から Cloudflare（無料、Terraform で管理）に移す
- [画像パイプラインの決定](issues/08-image-pipeline-decision.md) — presigned POST で S3 に直接アップロードし、S3 イベントで Go の Lambda が EXIF を除去した WebP を生成する。元画像はすぐに削除し、CloudFront の従量課金で配信する（ADR 0003）
- [環境と Terraform state の戦略](issues/09-environments-terraform-state.md) — （2026-10-20 改訂）dev と prod の 2 環境にする。dev は軽く作る（Supabase は一時停止してよい、CloudFront は従量課金）。state は S3 backend とネイティブロックで、環境ごとに別のキーに置く。state 用のバケットは bootstrap の Terraform で作る。メインリージョンは東京、ACM 用に us-east-1 も使う
- [Lambda の粒度](issues/10-lambda-granularity.md) — API は 1 つの Lambda（arm64）にまとめ、oapi-codegen のルーターをローカルと共通で使う。画像変換は別の関数にする（ADR 0004）
- [フロントのデータ取得の方針](issues/11-frontend-data-fetching.md) — バックエンドは Go の API だけ。公開ページは Server Components と ISR、人によって違う部分と操作はブラウザから Go の API を直接呼び、TanStack Query で管理する
- [ローカル開発環境](issues/12-local-dev-environment.md) — Supabase CLI のローカル環境とマイグレーションを使い、Makefile（dev / gen / db-reset）でまとめる。Lambda 固有の部分はローカルで再現せず、テストと本番へのデプロイで確かめる
- [匿名投稿の不正対策の決定](issues/13-anonymous-abuse-prevention-decision.md) — 匿名投稿は Supabase の匿名サインインで扱う。API の前に CloudFront の定額制 Free プラン（WAF 込み、超過料金なし）を置き、5 つの層で守る（ADR 0005）
- [JWT の検証場所](issues/14-jwt-verification-location.md) — Go のミドルウェアで Supabase の JWKS（ES256）を使って検証する。認証が必要なルートは openapi.yaml の security で宣言する（ADR 0006）

## 領域別マップへの引き継ぎ

### 進め方（2026-10-21 に決定）

決めたことを確かめるのに「作ってみるのがいちばん早い」領域は実装まで含め、論点が絡み合い実装量も大きい領域は計画だけにする。

| 領域別マップ | 進め方 | 理由 |
|---|---|---|
| 1. データモデル | 実装も含める | 設計の結果がそのままマイグレーションの SQL になり、`supabase db reset` ですぐ確かめられる |
| 2. バックエンド＋インフラ | 計画だけ（検証用の試作は含める） | 論点が多く絡み合う。WebP の実測や CloudFront 経由のヘッダーの確認など、作らないと決められないものは捨てる前提の試作チケットにする |
| 3. フロントエンド | 計画だけ（短く） | 決めることは少なく、書き直す量は大きい |
| 4. UI/UX | 実装も含める | 見た目と操作は、プロトタイプのチケットで試作してそのまま本物に育てる |
| 5. CI/CD・ドキュメント | 実装も含める | ワークフローは動かさないと正しいかわからず、規模も小さい |

2 と 3 で決めたことは、機能 1 つ分を全層まとめて作る**縦切り（バーティカルスライス）**で実装する。領域の順に実装すると、最後まで画面から DB まで通して動かないため。

1. データモデルのマップ（実装も含める）：テーブルと seed まで作る
2. バックエンド＋インフラのマップ（計画だけ＋試作）とフロントエンドのマップ（計画だけ）
3. 縦切りで実装する。縦切り 1「会場一覧」（DB → Go API → Lambda・API Gateway・CloudFront → Next.js のトップページ）で全層・dev 環境・CI/CD の土台を一度つなぐ。CI/CD のマップ（実装も含める）もここで進める。以降、座席レポの閲覧 → 匿名での投稿 → 画像付きの投稿…と続ける
4. UI/UX のマップ（実装も含める）：縦切りがある程度そろってから、見た目と操作を磨く

### 領域ごとの申し送り

<!-- 各チケットの「申し送り」を領域ごとに集めた索引。詳細はリンク先のチケットにある -->

1. **データモデル**
   - Supabase プロジェクトのリージョン（東京か）と署名鍵（非対称鍵か）を確かめ、必要なら作り直す。dev 用のプロジェクトも作る → [環境と Terraform state の戦略](issues/09-environments-terraform-state.md)、[JWT の検証場所](issues/14-jwt-verification-location.md)
   - テーブル設計（座席レポ、レポ画像、参戦日、匿名ユーザーとの紐付け）、Data API を塞ぐ設定、IP 単位のカウンタ、`pg_cron` による匿名ユーザーの掃除 → [データストアと認証基盤の選定](issues/06-datastore-auth-selection.md)、[匿名投稿の不正対策の決定](issues/13-anonymous-abuse-prevention-decision.md)
   - ディレクトリの再配置（モノレポ化）は、このマップの最初の作業として行う
2. **バックエンド＋インフラ**
   - oapi-codegen の OpenAPI 対応バージョン、検証ミドルウェアと JWT ライブラリの選定 → [API 契約の管理方式](issues/04-api-contract.md)、[JWT の検証場所](issues/14-jwt-verification-location.md)
   - Lambda のアダプタの選定、WebP エンコーダーの arm64 での実測、写真の向きの補正、HEIC の扱い → [Lambda の粒度](issues/10-lambda-granularity.md)、[画像パイプラインの決定](issues/08-image-pipeline-decision.md)
   - CloudFront 経由のクライアント IP の取り出し方、秘密ヘッダーの確認、投稿数の制限値 → [匿名投稿の不正対策の決定](issues/13-anonymous-abuse-prevention-decision.md)
   - Go・Supabase CLI・air・Terraform（1.10 以上）のインストール、ローカルでの Google と X のログイン → [ローカル開発環境](issues/12-local-dev-environment.md)、[環境と Terraform state の戦略](issues/09-environments-terraform-state.md)
   - 予算アラートの作成、CloudFront 定額制 Free プランへの加入、ACM（us-east-1）、`execute-api` の無効化、DNS の Cloudflare への移行と CAA、Supabase への定期アクセスの規約確認 → [AWS アカウントと無料枠の条件の確認](issues/01-aws-account-free-tier.md)、[匿名投稿の不正対策の決定](issues/13-anonymous-abuse-prevention-decision.md)、[ドメインと DNS の構成](issues/05-domain-dns.md)、[データストアと認証基盤の選定](issues/06-datastore-auth-selection.md)
3. **フロントエンド**
   - 投稿直後に一覧へ出ない問題（ISR）、JWT の保存場所と XSS 対策、Vercel Hobby の上限 → [フロントのデータ取得の方針](issues/11-frontend-data-fetching.md)
4. **UI/UX**
   - 画像変換中の「処理中」の見せ方 → [画像パイプラインの決定](issues/08-image-pipeline-decision.md)
   - 一時停止中（HTTP 540）のエラー表示 → [データストアと認証基盤の選定](issues/06-datastore-auth-selection.md)
5. **CI/CD・ドキュメント**
   - GitHub Actions の OIDC ロール（bootstrap で作る）、dev と prod への plan/apply の流れ（develop → dev、main → prod）、`supabase db push` の実行タイミング、Supabase への定期アクセスの cron → [環境と Terraform state の戦略](issues/09-environments-terraform-state.md)、[ローカル開発環境](issues/12-local-dev-environment.md)、[データストアと認証基盤の選定](issues/06-datastore-auth-selection.md)

## Not yet specified

- **領域別マップの中身**：データモデル（テーブル設計、RLS の要否、マイグレーション）／バックエンド（レイヤー構成、エンドポイント、エラー設計）／インフラ（Terraform モジュールの分け方）／フロントエンド（features 構成、shadcn/ui の導入）／UI/UX（ダークモード、投稿フロー）／CI/CD・ドキュメント。横断の判断が固まるにつれて、それぞれ独立したマップとして立ち上げる。
- **監視とログ**：CloudWatch Logs の保持期間とコスト、エラー通知をどうするか。
- **テスト戦略**：Go の層ごとのテスト、E2E をどこまでやるか。API 契約はスキーマ先行で決まったので、スキーマに対する契約テスト（実装がスキーマどおりのレスポンスを返すか）をどこで行うかも含む。
- **CI/CD の詳細**：GitHub Actions と AWS の OIDC 連携、どのタイミングで plan/apply するか。環境は dev と prod の 2 つ（PR で dev、main で prod に反映する流れを想定）、state は S3 backend、OIDC ロールは bootstrap で作ることが決まっている。
- **普段の作業で使う AWS の認証**：IAM Identity Center の作業用ユーザーを作るか、`aws login` で足りるか。ルートユーザーを日常的に使わないためのもので、インフラのマップで扱う。
- **ディレクトリの再配置**：モノレポ化（frontend/・backend/・infrastructure/・api/・supabase/）の実作業。ローカル開発環境とフロントのデータ取得の方針が決まったので、領域別マップの最初の作業として扱う。

## Out of scope

- 公演エンティティの導入：保守の負担が大きいため。参戦日で代わりにする。
- 既存の座席レポ・ユーザーデータの移行：本番ユーザーがおらず、テストデータしかないため。
- 既存機能との後方互換・段階的な切り替え：本番ユーザーがいないため。
