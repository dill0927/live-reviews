# 環境と Terraform state の戦略

Type: grilling
Status: resolved
Blocked by: 01

## Question

環境をいくつ持つか（dev のみ／dev と prod）と、Terraform の state をどこに置くか（S3 backend とネイティブロック／HCP Terraform など）、state の保管先自体をどう作るか（bootstrap の方法）を決める。

## Answer

- **環境の数**：クラウド上は prod の 1 環境とローカル開発環境（Supabase CLI のローカル環境と `go run`）だけにする。本番の利用者がまだいないので、prod が検証環境も兼ねる。dev と prod の 2 環境にしない理由は、Supabase の無料枠（2 プロジェクト）を使い切るうえに、一時停止への対策や OAuth の設定が 2 倍になるため。
- **あとから環境を足せるように書く**：検証環境が必要になったら、`environments/prod/` をコピーして足す。そのために次のルールを守る。
  - リソース名やドメインに `prod` を直接書かず、変数（`var.env` など）から組み立てる。
  - 環境ごとに異なる値は `tfvars` にまとめる。
  - DB の構造はマイグレーションのファイルだけで変え、管理画面で直接いじらない。
  - 会場とアーティストの seed はスクリプトで流せるようにする。
- **state の保存先**：S3 backend で、ロックには S3 のネイティブロック（`use_lockfile = true`、Terraform 1.10 以降）を使う。DynamoDB と HCP Terraform は使わない。バケットはバージョニング、暗号化、パブリックアクセスのブロックを有効にする。
- **state 用バケットの作り方**：`infrastructure/bootstrap/` という小さな Terraform を別に用意する。最初はローカルの state で apply し、そのあと `terraform init -migrate-state` で、bootstrap 自身の state も作ったバケットに移す。手順は README に書く。CI 用の OIDC ロールもここで作る想定（詳細は CI/CD のマップで決める）。
- **リージョン**：メインは ap-northeast-1。CloudFront 用の ACM 証明書のために、us-east-1 のプロバイダをもう 1 つ定義する。Supabase も東京リージョンにそろえる。
- 申し送り（データモデルのマップ）：今の Supabase プロジェクトのリージョンを確かめる。東京でなければ作り直す（seed 以外のデータは引き継がないので負担は小さい）。
- 申し送り（インフラのマップ）：Terraform はまだインストールしていない。バージョンは 1.10 以上にする。
