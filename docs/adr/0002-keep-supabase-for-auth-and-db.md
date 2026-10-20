# 認証と DB には Supabase を使い続ける

API とメディア配信は AWS（Lambda・API Gateway・S3・CloudFront）に移すが、認証は Supabase Auth、DB は Supabase の Postgres を使い続ける。判断基準は「固定費ゼロ → 運用の手間 → AWS での統一 → 学習価値」の順で、X（Twitter）ログインを残すことを前提にした。X をソーシャルログインとして組み込みで扱えるのは、比較した候補のうち Supabase Auth だけだった。認証を Supabase に残すなら、DB も同じ場所に置くほうが、ユーザーとデータの整合や運用の手間の面で有利になる。

## Considered Options

- **Cognito（認証）**：Always Free で 10,000 MAU まで使えるが、組み込みのソーシャルログインは Google・Apple・Facebook・Amazon だけで、X に対応していない。X は `openid` スコープを提供しておらず、OIDC として登録するのも難しい。
- **Aurora DSQL（DB）**：Always Free 枠があり、VPC なしで IAM 認証で接続でき、AWS に統一できる。しかしユーザー情報が Supabase 側に残るため、2 か所の整合をとる手間が増える。トリガーや PL/pgSQL が使えないといった制約もある。
- **Neon（DB）**：プロジェクトの一時停止がない。しかし認証が Supabase に残る以上、一時停止への対策は不要にならず、利用するサービスが 1 つ増えるだけになる。
- **DynamoDB / Aurora Serverless v2**：データがリレーショナルで、会場ごとの集計や会場名の部分一致検索が必要なため DynamoDB は合わない。Aurora Serverless v2 は VPC が前提で、VPC 外の Lambda から使うと固定費がかかる。

## Consequences

- フロントエンドから Supabase を直接呼ぶのは認証（ログイン・セッション管理）だけにする。DB の読み書きはすべて Go の API を通し、Data API（PostgREST）からは `public` スキーマに触れられないようにする。
- Go の Lambda からは Supavisor（transaction mode、IPv4）経由で接続する。
- Supabase の Free プランは、7 日間 DB の活動がないとプロジェクトごと一時停止する。これを防ぐため、GitHub Actions の cron で API のヘルスチェック（DB に軽いクエリを流す）を定期的に呼ぶ。
