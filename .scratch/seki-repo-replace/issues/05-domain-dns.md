# ドメインと DNS の構成

Type: grilling
Status: resolved
Blocked by: —

## Question

sekirepo.com を使い続ける前提で、フロント・API・画像配信をどのホスト名で公開するか（例：api.sekirepo.com / img.sekirepo.com）と、DNS をどこで管理するか（今の管理場所のまま／Route 53 に移す。Route 53 はホストゾーンに月 $0.50 の固定費）を決める。

## Answer

**今の構成（2026-10-20 に dig / whois / curl で確認）**
- ドメインの登録先はお名前.com（有効期限 2027-03-24）。DNS はお名前.com（`dnsv.jp`）。
- 正式な URL は `www.sekirepo.com`（Vercel）。`sekirepo.com` は `www` へ 308 で転送している。
- メールは ImprovMX で転送している（MX、SPF の TXT）。ほかに Google Search Console の所有確認用 TXT がある。CAA レコードはない。

**決定**
- **ホスト名**
  - フロントエンド：`www.sekirepo.com`（今のまま。apex は www へ転送）
  - API：`api.sekirepo.com`（API Gateway HTTP API のカスタムドメイン。ACM 証明書は ap-northeast-1）
  - 画像：`img.sekirepo.com`（CloudFront。ACM 証明書は us-east-1）
  - API の前に CloudFront を置くかどうかは「匿名投稿の不正対策の決定」で決めるが、どちらでもホスト名は変わらない。
- **DNS の管理先**：Cloudflare の DNS（無料プラン）に移す。ドメインの登録先はお名前.com のままにし、ネームサーバーだけを切り替える。レコードは Terraform の Cloudflare プロバイダで管理する。プロキシ機能はオフにして、DNS としてだけ使う。
  - お名前.com の DNS のままにしない理由：Terraform で管理できず、ACM の検証用レコードなどを手で登録することになるため。
  - Route 53 にしない理由：ホストゾーンに月 $0.50 の固定費がかかり、「固定費ゼロ」に反するため。
- 申し送り（インフラのマップ）
  - ネームサーバーを切り替えるときは、今あるレコード（Vercel の A と CNAME、ImprovMX の MX、SPF と Google の TXT）を漏れなく移す。
  - CAA レコードを追加するか（ACM の `amazon.com` を許可する、など）を決める。
  - Supabase Auth の独自ドメイン（`auth.sekirepo.com` など）は有料アドオンなので使わない。そのため、Google や X のログイン画面には Supabase のドメインが表示される。

補足（匿名投稿の不正対策の決定から）：api.sekirepo.com は CloudFront（定額制 Free プラン）を指すことになったので、API の ACM 証明書も us-east-1 で発行する。

補足（環境と Terraform state の戦略の改訂から）：dev 環境を作ることになったので、dev 用に `api-dev.sekirepo.com` と `img-dev.sekirepo.com` を追加する。フロントの dev は Vercel の Preview（develop ブランチ）。
