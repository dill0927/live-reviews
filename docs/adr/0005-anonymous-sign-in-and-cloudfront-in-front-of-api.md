# 匿名投稿は Supabase の匿名サインインで扱い、API の前に CloudFront の定額制 Free プランを置く

ログインせずに投稿する「匿名投稿」は、認証なしのリクエストとしてではなく、Supabase Auth の匿名サインイン（`is_anonymous` の付いた JWT）で扱う。これで Go の API は「必ず JWT が付いている」前提で 1 本の認証経路にでき、匿名でも同じブラウザからなら編集・削除でき、本登録すると座席レポを引き継げる。荒らし対策は層を重ね、追加の費用がかからない手段だけで組む。そのうえで、API の前に CloudFront の定額制 Free プラン（WAF と IP 単位のレート制限を含み、超過料金なし）を置き、大量のリクエストを受けても費用が増えないことを保証する。

## 防御の層

1. Supabase の匿名サインインに Turnstile をかける（公式が強く推奨）。IP 単位の制限（標準で 1 時間 30 回）もかかる。
2. CloudFront の WAF で、IP 単位のレート制限をかける。
3. API Gateway HTTP API で、書き込み系ルートのスロットリングをかける。
4. Go の usecase 層で、ユーザー単位と IP 単位の投稿数を制限する（カウンタは Supabase の Postgres）。
5. API の Lambda に予約済み同時実行数を設定し、費用の上限を決めておく。

## Considered Options

- **完全な匿名（認証なしで投稿）**：単純だが、匿名の座席レポを編集・削除できず、API に「JWT なし」の経路が残る。
- **CloudFront を置かない**：構成は単純だが、大量のリクエストを受けたとき、API Gateway のリクエスト課金を止められない。IP 単位の制限も、Lambda の中で自前で作ることになる。
- **AWS WAF を従量課金で付ける**：Web ACL だけで月 $5 の固定費がかかる。
- **API Gateway を REST API にして WAF を付ける**：固定費がかかるうえ、HTTP API より高い。

## Consequences

- `api.sekirepo.com` は CloudFront を指すので、API の ACM 証明書も us-east-1 で発行する。
- 裏口対策として、API Gateway の `execute-api` エンドポイントを無効にし、CloudFront から送る秘密のヘッダーを Lambda で確認する。
- CloudFront を通るので、利用者の IP アドレスは `X-Forwarded-For` などのヘッダーから取り出す。届くヘッダーは実機で確かめる。
- 定額制プランには「AWS Free Tier を使用中のアカウントは加入できない」という条件がある。このアカウントは従来の 12 か月無料枠が終わっているので該当しない見込みだが、加入できなかったときは CloudFront を置かない構成に戻す（ホスト名は変わらない）。
- 投稿のない匿名ユーザーは、30 日後に削除する。
