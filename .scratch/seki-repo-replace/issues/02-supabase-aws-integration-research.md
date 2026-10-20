# Supabase と AWS の連携方式の調査

Type: research
Status: resolved
Blocked by: —

## Question

Go の Lambda から Supabase を使う場合の事実を一次情報で調べる：(1) DB 接続方式の選択肢（Supavisor の transaction/session mode、直接接続、PostgREST/Data API 経由）とそれぞれの制約（prepared statement、IPv4/IPv6、接続数上限、無料プランの制限）(2) Supabase Auth の JWT 署名方式（非対称鍵／JWKS エンドポイントの有無、従来の HS256 secret）と、API Gateway HTTP API の JWT Authorizer で検証できるか (3) 無料プランの一時停止（非アクティブ時の pause）など運用上の制約。

## Research

調査結果：[docs/research/supabase-aws-integration.md](../../../docs/research/supabase-aws-integration.md)

## Answer

- **DB 接続**：VPC 外の Lambda は IPv6 で外に出られない。Supabase の直接接続は IPv6 なので届かず、IPv4 にするアドオンは有料（Pro 以上で約 $4/月）。そのため無料プランでは **Supavisor の共有プーラー（IPv4、transaction mode、ポート 6543）** を使うことになる。Supabase がサーバーレス向けに推奨している設定は、プールサイズ 1、prepared statement 無効、SSL require。Go の pgx は `QueryExecModeExec` を使う（Supavisor との組み合わせは実機で未確認）。無料プランの上限は、プーラーのクライアント接続が 200。
- **JWT**：2025-10-01 以降の新規プロジェクトは非対称鍵が既定で、推奨は ES256（RS256 も選べる）。HS256 の共有 secret は非推奨。anon / service_role キーは 2026 年末までに廃止予定。JWKS の URL は `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`。`iss` は `https://<ref>.supabase.co/auth/v1`、`aud` は `authenticated`。（訂正：匿名サインインのユーザーもロールは `authenticated` で、匿名かどうかは JWT の `is_anonymous` で見分ける。Supabase の公式ドキュメント「Anonymous Sign-Ins」で 2026-10-20 に確認）
- **API Gateway の JWT Authorizer**：RSA 系の鍵しか扱えないため、ES256 は検証できない。また JWKS を最大 2 時間キャッシュするので、Supabase が求める「キャッシュは 10 分以内」と合わない。Go で検証する場合の代表的なライブラリは golang-jwt v5 ＋ keyfunc v3、または lestrrat-go/jwx。
- **無料プランの制約**：**7 日間アクセスがないとプロジェクトが一時停止する**。ほかに DB 500MB、egress 5GB、アクティブなプロジェクトは 2 つまで、MAU 50,000。
- 未確認のまま残った点：新規プロジェクトで既定になる鍵のアルゴリズム、API Gateway が `nbf` のないトークンを拒否しないか、Supavisor と pgx の exec モードの組み合わせ。
