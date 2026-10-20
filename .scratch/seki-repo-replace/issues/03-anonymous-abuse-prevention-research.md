# 匿名投稿の不正対策の調査

Type: research
Status: resolved
Blocked by: —

## Question

匿名投稿（テキストのみ）のスパム・荒らし対策として、追加の固定費なしで使える手段を一次情報で調べる：Cloudflare Turnstile の無料枠とサーバー側検証の方法、API Gateway HTTP API のスロットリング（ルート単位・アカウント単位）、AWS WAF の料金（固定費が発生するか）、IP 単位の流量制限を Lambda 側で実装する場合の選択肢。

## Research

調査結果：[docs/research/anonymous-abuse-prevention.md](../../../docs/research/anonymous-abuse-prevention.md)

## Answer

- **Turnstile**：無料で、チャレンジ数は無制限。DNS を Cloudflare に移す必要はない。トークンは 300 秒で失効し、検証は1回限り。サーバー側（Go の Lambda）で siteverify を必ず呼ぶ。
- **API Gateway HTTP API のスロットリング**：ステージ単位とルート単位だけで、**IP 単位の制限はできない**。
- **AWS WAF**：HTTP API には直接付けられない。REST API か CloudFront を経由する必要があり、Web ACL だけで $5/月の固定費がかかる。例外として CloudFront 定額制の Free プラン（$0）には WAF と IP 単位のレート制限が含まれるが、「AWS Free Tier 使用中のアカウントは対象外」という条件の解釈は**未確認**。
- **IP の取得とカウンタ**：IP は `requestContext.http.sourceIp` で取れる。固定費なしで IP 単位の制限をかけるなら、Lambda の中で実装するのが現実的。カウンタは Supabase か DynamoDB（Always Free の範囲内）に置く。
- **予約済み同時実行数**：Lambda の予約済み同時実行数は追加料金なしで使える。IP 単位ではないが、コストが膨らまないよう全体に上限をかける手段になる。
- 未確認のまま残った点：429 で拒否されたリクエストが課金されるか、CloudFront 経由のときの `sourceIp` の値、`execute-api` への直接アクセスを遮断する方法。
