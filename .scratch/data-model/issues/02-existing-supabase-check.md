# 既存の Supabase プロジェクトの確認とマスタの退避

Type: task（HITL）
Status: open
Blocked by:

## Question

今の Supabase プロジェクトについて、次の事実を確かめて記録する。
- リージョンが東京（ap-northeast-1）か（環境と Terraform state の戦略の申し送り）
- JWT の署名鍵が非対称鍵（ES256）か、HS256 のままか（JWT の検証場所の申し送り）
- 会場とアーティストのマスタ（`venues`・`artists`）の件数と列

そのうえで、prod を作り直すことになっても困らないように、会場とアーティストのデータを取り出してリポジトリの外（または seed の元データとしてリポジトリ内）に退避する。取り出し方（管理画面の CSV 出力、`pg_dump` など）と保存場所を記録する。
