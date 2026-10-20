# 匿名投稿の不正対策の決定

Type: grilling
Status: resolved
Blocked by: 01, 03, 05, 06

## Question

「匿名投稿の不正対策の調査」の結果をもとに、匿名投稿をどう守るか決める。論点は次の3つ。
- Turnstile、ルート単位のスロットリング、Lambda 内での IP 単位の制限、予約済み同時実行数のうち、どれを組み合わせるか
- IP 単位のカウンタをどこに置くか
- API の前段に CloudFront を置くか（CloudFront 定額制の Free プランを使えるかどうかにも左右される）

補足（Supabase と AWS の連携方式の調査から）：Supabase Auth には匿名サインインがある（JWT の `aud` が `anon` になる）。これを使えば、匿名投稿でも「同じブラウザからなら編集・削除できる」ようにする余地がある。チャーティング時に決めた「匿名投稿は編集・削除不可」を見直すかどうかも、ここで扱う。

補足（データストアと認証基盤の選定から）：DB は Supabase の Postgres に決まったので、IP 単位のカウンタの置き場所の第一候補は Supabase の Postgres。

補足（ドメインと DNS の構成から）：DNS は Cloudflare に移すことになったので、Turnstile も同じ Cloudflare アカウントで管理できる。ホスト名は api.sekirepo.com に決まった（CloudFront を前に置くかどうかで変わらない）。

## Answer

ADR：[匿名投稿は Supabase の匿名サインインで扱い、API の前に CloudFront の定額制 Free プランを置く](../../../docs/adr/0005-anonymous-sign-in-and-cloudfront-in-front-of-api.md)

- **匿名投稿の仕組み**：Supabase Auth の匿名サインインを使う。Go の API は、すべての書き込みで JWT を求める。匿名かどうかは JWT の `is_anonymous` で見分ける（ロールは `authenticated`）。匿名でも、同じブラウザからなら編集・削除できる。本登録（`updateUser` / `linkIdentity`。手動リンクを有効にしておく）すると、座席レポを引き継げる。画像はこれまでどおり本登録したユーザーだけが付けられる。
- **API の前に CloudFront を置く**：定額制の Free プラン（$0、超過料金なし、WAF と IP 単位のレート制限を含む）を使う。配信元は API Gateway で、管理ポリシーは `AllViewerExceptHostHeader`。加入できなかったときは、CloudFront を置かない構成に戻す。
- **防御の層**：① 匿名サインインに Turnstile をかける（IP 単位の制限は標準で 1 時間 30 回）② CloudFront の WAF による IP 単位のレート制限 ③ API Gateway の書き込み系ルートのスロットリング ④ Go の usecase 層での投稿数の制限（ユーザー単位と IP 単位。カウンタは Supabase の Postgres）⑤ API の Lambda の予約済み同時実行数。
- **匿名ユーザーの掃除**：座席レポを 1 件も投稿していない匿名ユーザーを、30 日後に `pg_cron` で削除する。
- **確認した事実（2026-10-20、公式ドキュメント）**：Supabase は匿名サインインに CAPTCHA または Turnstile を強く推奨しており、IP 単位の制限は標準で 1 時間 30 回。古い匿名ユーザーを自動で消す機能はない。CloudFront の定額制 Free プランは、月 100 万リクエスト・100GB まで、超過しても課金されない（性能が調整されることはある）。WAF でブロックしたリクエストは使用量に数えない。1 アカウントにつき 3 つまで作れる。「AWS Free Tier を使用中のアカウント」は加入できない。API Gateway HTTP API は、標準の `execute-api` エンドポイントを無効にできる。
- 申し送り（インフラのマップ）
  - 定額制 Free プランに加入できるかを確かめる（Terraform で書けるか、だめなら CLI で加入）。
  - `api.sekirepo.com` の ACM 証明書を us-east-1 で発行する（「ドメインと DNS の構成」で ap-northeast-1 としていた点を変更）。
  - `execute-api` エンドポイントを無効にし、CloudFront から秘密のヘッダーを付ける。
  - 画像用の CloudFront も Free プランにするかを決める。
  - `pg_cron` が無料プランで使えるかを確かめる。
- 申し送り（バックエンドのマップ）
  - CloudFront 経由で届く利用者の IP アドレスを、どのヘッダーから取るかを実機で確かめる。
  - 秘密のヘッダーを確認するミドルウェアを作る。
  - 投稿数の制限の具体的な数値を決める。
  - `is_anonymous` で権限を分ける（画像の可否）。

補足（環境と Terraform state の戦略の改訂から）：dev 環境を作ることになった。CloudFront の定額制 Free プランは prod の画像用と API 用に使い、dev は従量課金にする（dev には WAF がない）。
