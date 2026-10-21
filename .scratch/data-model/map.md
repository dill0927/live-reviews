# データモデル（領域別マップ）

Label: wayfinder:map
Status: open（2026-10-21 作成）
親：[SEKI-REPO リプレイス（メタマップ）](../seki-repo-replace/map.md) の「領域別マップへの引き継ぎ」の 1 番目

## Destination

モノレポの `supabase/` に、テーブル・制約・権限・定期処理のマイグレーションと、会場とアーティストの seed がそろい、`make db-reset` でローカルに毎回同じ DB を再現できる。そのマイグレーションが dev の Supabase プロジェクトにも反映され、クラウド上でも意図どおりに動くこと（Data API から触れないことなど）を確かめ終えている。

## Notes

- **実装も含める**マップ。設計を決める grilling のチケットは、決めたあと同じセッションでマイグレーションの SQL を書き、`make db-reset` で確かめるところまでを 1 チケットとする。決めることがない作業（プロジェクトの準備、dev への反映）だけを task にする。
- セッションごとに `/grilling` と `/domain-modeling` を使う。research チケットは `/research` のサブエージェントで解決する。
- 用語は [CONTEXT.md](../../CONTEXT.md) に従う。テーブル名や列名も用語集と合わせる（「レビュー」ではなく「座席レポ」）。新しい用語が確定したらその場で CONTEXT.md を更新する。ADR の 3 条件（元に戻しにくい・背景なしでは意外・本物のトレードオフ）を満たす判断は `docs/adr/` に残す。
- 学習も兼ねるので、各判断では「なぜそうするか」を言語化し、新しい用語は具体例とセットで説明する。
- チケットのファイルは `issues/` にある。frontier（今取りかかれるもの）は、`Status: open` で、`Blocked by` のチケットがすべて resolved のもののうち、番号が若い順。取りかかるときは `Status: claimed` にしてから始める。
- 決定済みの前提（チャーティング時に確定）：
  - prod への反映は、このマップでは行わない（いつ・誰が `supabase db push` するかは CI/CD のマップで決める）。
  - Supabase プロジェクトの準備（リージョン・署名鍵の確認、dev の作成、必要なら prod の作り直し）は、このマップで行う。
  - モノレポ化は、今の Next.js を `frontend/` に移し、`supabase/` を作るところまで。`backend/`・`infrastructure/`・`api/` は中身ができる各マップで作る。Makefile は `db-reset` だけ作る。
  - Go から DB にアクセスする方法（sqlc、pgx など）は、バックエンドのマップで決める。このマップの成果物は SQL のスキーマと seed で閉じる。
  - 現行のテーブル（`venues`・`artists`・`reviews`・`likes`・`users`）と、新しく必要なもの（レポ画像、IP 単位のカウンタ、匿名ユーザーの掃除）をすべて扱う。機能の要否は「テーブルを作るかどうか」の範囲で決め、見せ方は UI/UX のマップに回す。
- 現行の参考（2026-10-21 に確認）：4 軸評価は列で持ち、軸ごとにコメントの列がある（`visibility` / `v_comment` など）。座席番号は自由入力の文字列で、検索は部分一致。期間の絞り込みは参戦日ではなく投稿日（`created_at`）。会場の検索は `search_venues` という RPC。

## Decisions so far

<!-- 解決したチケットごとに1行：[チケット名](issues/NN-xxx.md) — 結論の要約 -->

- [Supabase の無料プランで使える機能の調査](issues/04-supabase-free-plan-research.md) — Data API は `config.toml` で丸ごと無効にでき、コードで管理できる。2026-10-30 から新しいテーブルに anon などへの grant が付かない。匿名ユーザーは SQL で消してよい（公式に例あり）。マイグレーションで作ったテーブルは RLS が既定で無効。公式は専用の DB ロールを勧めている。pg_cron が無料プランで使えるかは未確認で、dev で確かめる
- [ディレクトリの再配置（モノレポ化）](issues/01-monorepo-layout.md) — Next.js を `frontend/` に移し、`supabase init` と Makefile（`db-reset` だけ）を用意した。Supabase CLI は 2.121.0。Vercel の Root Directory は `main` へのマージ時に `frontend` に変える
- [既存の Supabase プロジェクトの確認とマスタの退避](issues/02-existing-supabase-check.md) — 現行は re-sekirepo（東京・Postgres 17）で作り直し不要、署名鍵は HS256 のままなので移行が要る。会場 28 件・アーティスト 45 件を `backup/` に退避した。anon で全テーブルを書き換えられたので、本番に応急処置の RLS を入れた

## Not yet specified

- **読み取りの要件（検索・集計）とインデックス**：座席の検索（部分一致か、構造化した座席番号で絞るか）、コメントのキーワード検索（日本語の部分一致をどう速くするか）、参戦日での期間の絞り込み、会場ごとの 4 軸評価の平均（今はブラウザで計算している。ビューや集計用のテーブルにするか）、会場の検索（今の `search_venues`）。座席レポのテーブルが決まると問いを立てられる。

## Out of scope

- 会場やアーティストを管理する画面：マスタの追加・修正は seed やマイグレーションの SQL で行う。本番ユーザーがいない今は、作る手間に見合わないため。
- 不適切な座席レポの通報と、管理者による非表示：テーブルも機能も増えるわりに、今は必要がなく、ポートフォリオとしての見せ場にもなりにくいため。必要になったら別の取り組みとして立ち上げる。
- prod の Supabase への反映：CI/CD のマップで扱う。
