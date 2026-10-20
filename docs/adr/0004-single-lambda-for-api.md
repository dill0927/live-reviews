# API は 1 つの Lambda にまとめる（Lambdalith）

Go の API は、oapi-codegen が `api/openapi.yaml` から生成するルーター（`http.Handler`）を 1 つの Lambda（Event Functions・On-Demand・arm64）にそのまま載せる。ローカル用の `cmd/api`（普通の Web サーバー）と Lambda 用の `cmd/lambda`（API Gateway のイベントを HTTP リクエストに変換するアダプタで包む）は同じハンドラを共有し、Lambda 固有のコードは入口の数行だけにする。AWS の資料は新規開発ではルートごとに関数を分ける形（micro-Lambda）を勧めているが、エンドポイントが少なく一人で開発・運用する規模では、関数・IAM ロール・ロググループがルートの数だけ増える手間が、得られる利点を上回るため採らなかった。

## Considered Options

- **ルートごとに Lambda を分ける（micro-Lambda）**：関数単位で最小権限と同時実行数の上限を設定できるが、管理対象がルートの数だけ増える。OpenAPI から生成した 1 つのルーターをそのまま載せる構成もとれない。
- **権限の種類で 2 つに分ける（読み取り用と書き込み用。コードは共通）**：最小権限と書き込み側の同時実行数の制限を両立できるが、今の規模では (a) で足りる。匿名投稿の流量制限は API Gateway のルート単位のスロットリングでかけられる。
- **Web Functions**：Node.js 専用のため対象外。

## Consequences

- 権限の範囲は、関数の役割を分けることで抑える。API の関数には「DB への接続」と「一時置き場への presigned POST の発行」だけを与え、S3 からの読み取りと削除は画像変換の関数にだけ与える。
- Terraform のモジュールは「ルートと関数の対応表」を受け取る形にしておき、将来、権限や負荷の性質に応じて関数を分けられるようにする。
