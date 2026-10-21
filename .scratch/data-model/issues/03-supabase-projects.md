# dev と prod の Supabase プロジェクトの用意

Type: task（HITL）
Status: open
Blocked by: 02

## Question

「既存の Supabase プロジェクトの確認とマスタの退避」の結果をもとに、次を行う。
- prod：リージョンが東京でなければ作り直す。東京なら、署名鍵を非対称鍵に移行する（HS256 のままの場合）。
- dev：無料枠の 2 つ目のプロジェクトとして、東京リージョンで作る。
- 両方のプロジェクトの ref、URL、接続文字列（Supavisor の transaction mode）の保管場所を記録する（値そのものはリポジトリに書かない）。

既存プロジェクトの作り直しや削除は元に戻せないので、手順をユーザーに渡して実行してもらう。
