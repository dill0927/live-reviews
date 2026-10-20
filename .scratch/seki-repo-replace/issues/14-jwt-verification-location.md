# JWT の検証場所

Type: grilling
Status: resolved
Blocked by: 02, 06

## Question

ログインしたユーザーの JWT を、API Gateway の JWT Authorizer で検証するか、Go のミドルウェアで検証するかを決める。

調査で次の点がわかっている。
- JWT Authorizer は RSA 系の鍵しか扱えず、Supabase が推奨する ES256 は検証できない。
- JWT Authorizer は JWKS を最大 2 時間キャッシュするため、Supabase が求める「10 分以内」と合わない。

これらを踏まえ、鍵のアルゴリズムの選択と、匿名の呼び出しも同じ経路で受けるかもあわせて決める。

補足（データストアと認証基盤の選定から）：認証は Supabase Auth に決まった。

補足（匿名投稿の不正対策の決定から）：匿名投稿も Supabase の匿名サインインの JWT（`is_anonymous` 付き）で行う。API の前には CloudFront が置かれる。JWT は Authorization ヘッダーで届く（`AllViewerExceptHostHeader` は Host 以外のヘッダーを転送する）。

## Answer

ADR：[JWT は API Gateway のオーソライザーではなく Go のミドルウェアで検証する](../../../docs/adr/0006-verify-jwt-in-go-middleware.md)

- **検証する場所**：Lambda の中の Go のミドルウェア。Supabase の JWKS を取得して署名を確かめ、`exp`、`iss`（自分のプロジェクトの `https://<ref>.supabase.co/auth/v1`）、`aud`（`authenticated`）を確かめる。JWKS のキャッシュは 10 分以内にする。ライブラリの候補は golang-jwt v5 と keyfunc v3（最終的な選定はバックエンドのマップで行う）。API Gateway の JWT オーソライザーと Lambda オーソライザーは使わない。
- **認証が必要なルートの宣言**：`openapi.yaml` の `security`（Bearer）で、エンドポイントごとに宣言する。段階は 3 つ。
  - 不要：公開ページ用の GET
  - JWT が必要（匿名でもよい）：座席レポの投稿・編集・削除、いいね、マイページ
  - 本登録が必要：画像アップロード用の presigned POST の発行（usecase 層で `is_anonymous` を見て判断する）
- **宣言漏れの防止**：書き込み系のルートに `security` が付いていなければ失敗するテストを用意する。
- **署名方式**：Supabase の非対称鍵（推奨の ES256）。Lambda には JWT 用の秘密の情報を持たせない。HS256 の共有シークレットは使わない。
- 申し送り（データモデルのマップ）：今の Supabase プロジェクトが非対称鍵になっているかを確かめる。HS256 のままなら管理画面で移行する（リージョンが東京でなく作り直す場合は、最初から非対称鍵になる）。
