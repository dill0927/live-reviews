# dev と prod の Supabase プロジェクトの用意

Type: task（HITL）
Status: resolved
Blocked by: 02

## Question

「既存の Supabase プロジェクトの確認とマスタの退避」の結果をもとに、次を行う。
- prod：今の re-sekirepo（東京・Postgres 17）をそのまま使い、署名鍵を HS256 から非対称鍵に移行する（作り直しは不要と確定）。
- 一時停止中の古いプロジェクト live-reviews（ref `dijapmjyqzdspjwdxyge`）を削除するか残すか。dev を作るときに、無料プランのプロジェクト数の上限に引っかかるかどうかも確かめる。
- dev：無料枠の 2 つ目のプロジェクトとして、東京リージョンで作る。
- 両方のプロジェクトの ref、URL、接続文字列（Supavisor の transaction mode）の保管場所を記録する（値そのものはリポジトリに書かない）。

既存プロジェクトの作り直しや削除は元に戻せないので、手順をユーザーに渡して実行してもらう。

## Resolution（2026-10-21）

### 行ったこと（ユーザーがダッシュボードで実行）
- 古いプロジェクト **live-reviews**（ref `dijapmjyqzdspjwdxyge`）を**削除**した。アプリで使っておらず、残すと取り違えやすいため。なお、一時停止中のプロジェクトは無料プランのプロジェクト数の上限（2 つ）に数えない（[公式](https://supabase.com/docs/guides/platform/billing-on-supabase)）ので、上限の問題はもともとなかった。
- dev として **re-sekirepo-dev** を東京リージョンで作った。作成画面の設定は、「データ API を有効にする」「新しいテーブルを自動的に公開する」「自動 RLS を有効にする」をすべて**オフ**にした。いちばん閉じた状態で作り、最終的な形はマイグレーションと `config.toml` で決めるため。自動 RLS（`ensure_rls` のイベントトリガー）は、ダッシュボードで入れると dev にだけでき、ローカルと食い違うので入れなかった。
- dev の署名鍵は、作成時から **ECC P-256（ES256）** だった。移行は不要。
- prod（re-sekirepo）の署名鍵を移行した：Migrate JWT secret → ES256 の待機中の鍵を作成 → Rotate keys。本番のサイトで、会場の一覧が表示されることとログインできることを確かめた。**旧来の秘密鍵（Legacy JWT secret）は revoke していない**。今のフロントの anon キーが、その秘密鍵で署名された JWT のため。

### 確かめた事実（CLI と JWKS）
- `supabase projects list`：re-sekirepo（東京・Postgres 17.6.1）と re-sekirepo-dev（東京・Postgres 17.11.0）の 2 つだけ。ローカルの `config.toml` も `major_version = 17` で、メジャーバージョンはそろっている。
- prod の `/auth/v1/.well-known/jwks.json` が ES256（EC P-256）の公開鍵を返すようになった。Go の API は JWKS だけで JWT を検証できる（ADR 0006 の前提）。

### 値の保管場所
- ref・URL・DB パスワードは、**Chrome のパスワードマネージャー**に、プロジェクトごとのエントリ（ユーザー名 `re-sekirepo` / `re-sekirepo-dev`）として保存した。メモ欄に「DB パスワード（ログイン用ではない）」・ref・URL を書いた。値そのものはリポジトリに書かない。
- 接続文字列（Supavisor の transaction mode）は保存しない。含まれる秘密は DB パスワードだけで、残りはダッシュボードの Connect からいつでも取れる。実際に使うときに、バックエンドのマップで取り出す。

### 検討して採らなかったこと
- re-sekirepo の中にブランチ（Supabase Branching）を切って dev にする案。ブランチは 1 つずつ別のインスタンスで、最小サイズでも 1 時間あたり $0.01344（常時置くと月に約 $10）かかり、Spend Cap の対象外（[公式](https://supabase.com/docs/guides/platform/manage-your-usage/branching)）。無料プランで使えるかは公式に明記がない。PR ごとのプレビュー DB として使うかどうかは、CI/CD のマップで検討する。

### 申し送り
- prod の旧来の秘密鍵の revoke と、旧来の anon / service_role キーの無効化は、今のフロントを新しい構成に切り替えたあとに行う（リリースや CI/CD のマップで扱う）。
- prod は今のフロントのために Data API が有効のまま。新しい構成に切り替えるときに塞ぐ。
