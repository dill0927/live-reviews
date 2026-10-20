# Lambda の粒度

Type: grilling
Status: resolved
Blocked by: 06

## Question

Go の API を、単一の Lambda に HTTP ルーターを載せて動かすか、エンドポイントごとに Lambda を分けるかを決める。コールドスタート・デプロイの単位・IAM 権限の粒度・ローカル実行との共通化の観点で比較する。

## Answer

ADR：[API は 1 つの Lambda にまとめる（Lambdalith）](../../../docs/adr/0004-single-lambda-for-api.md)

- **種類**：Go なので Event Functions の On-Demand（API Gateway HTTP API から呼ぶ）。Web Functions は Node.js 専用のため対象外。
- **API の分け方**：1 つの Lambda にまとめる。oapi-codegen が生成するルーター（`http.Handler`）をそのまま載せる。
- **ローカルとの共通化**：`cmd/api`（ローカルの Web サーバー）と `cmd/lambda`（アダプタで包む）が同じハンドラを共有する。
- **画像変換**：S3 イベントで起動する別の Lambda（「画像パイプラインの決定」で決定済み）。
- **権限**：API の関数には DB への接続と、一時置き場への presigned POST の発行だけを与える。S3 からの読み取りと削除は画像変換の関数だけに与える。
- **CPU アーキテクチャ**：arm64（Graviton）。x86_64 より約 20% 安く、`GOARCH=arm64` でビルドするだけで済む。
- **将来の分割**：Terraform のモジュールは「ルートと関数の対応表」を受け取る形にし、必要になったら権限の種類（読み取り用と書き込み用）で分けられるようにする。
- 申し送り（バックエンドのマップ）：API Gateway のイベントを HTTP リクエストに変換するアダプタを選ぶ（aws-lambda-go-api-proxy、Lambda Web Adapter など）。cgo を使わない WebP エンコーダーが arm64 でも十分速いかを、画像変換の実測で確かめる。
