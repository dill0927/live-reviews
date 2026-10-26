# データモデル（領域別マップ）

Label: wayfinder:map
Status: 完了（2026-10-26）。チケット 13 件はすべて解決済み（2026-10-21 作成）
親：[SEKI-REPO リプレイス（メタマップ）](../seki-repo-replace/map.md) の「領域別マップへの引き継ぎ」の 1 番目

## Destination

モノレポの `supabase/` に、テーブル・制約・権限・定期処理のマイグレーションと、会場とアイドルのマスタ がそろい、`make db-reset` でローカルに毎回同じ DB を再現できる。そのマイグレーションが dev の Supabase プロジェクトにも反映され、クラウド上でも意図どおりに動くこと（Data API から触れないことなど）を確かめ終えている。

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
- [dev と prod の Supabase プロジェクトの用意](issues/03-supabase-projects.md) — 古い live-reviews を削除し、dev（re-sekirepo-dev・東京）を Data API・自動公開・自動 RLS をオフにして作った。prod の署名鍵は ES256 に移行した（旧来の秘密鍵は今のフロントのため残す）。DB パスワードなどは Chrome のパスワードマネージャーに保管し、リポジトリには書かない
- [スキーマ全体の規約](issues/05-schema-conventions.md) — テーブルは `app` スキーマに置く（ADR 0007）。名前は複数形の snake_case、ID は uuid v4、時刻は `timestamptz` で `updated_at` はトリガーで更新、物理削除、値の制約は OpenAPI と DB の `check` の両方に同じ値で書く。拡張機能は使うチケットで入れる。RLS の扱いは「Data API の封鎖と DB ロールの権限」に回した
- [Data API の封鎖と DB ロールの権限](issues/06-data-api-and-db-roles.md) — Data API は `enabled = false`・非公開スキーマ・権限なしの 3 層で塞ぐ。Go は専用ロール `sekirepo_api` で接続し、RLS は全テーブルで有効にしてそのロールだけにポリシーで開ける（ADR 0008）。テーブルごとに RLS・ポリシー・grant の 3 行を書き、`make db-test` の pgTAP で確かめる。パスワードはリポジトリに書かない
- [会場とアーティストのマスタと seed](issues/07-venue-artist-master.md) — 会場は今の列を残し、キャパは表示用の文字列 `capacity_note`、種別は check、画像はファイル名だけ。アーティストは `is_official` で公式を区別し、正規化した名前で一意にする。両方にひらがなの `kana` を必須で持つ。マスタは seed ではなくマイグレーションで入れる（ADR 0009）。会場 28 件・アーティスト 44 件（誤りを直した）
- [ユーザーのプロフィールと認証との紐付け](issues/08-user-profile.md) — `app.profiles`（表示名・アバターのシード）を `auth.users` へのトリガーで匿名ユーザーにも作る。`confirmed` は持たず Auth を正とする。座席レポなどは `profiles` を参照し、退会しても `set null` で残す。`artists.created_by` を足した
- [座席レポのテーブル](issues/09-seat-report-table.md) — `app.seat_reports`。4 軸を「見やすさ・ファンサ・周辺施設・アクセス」に変え（音響を外した）、列で持ち全軸必須の 1〜5、コメントは任意。座席番号は自由入力、参戦日は必須にし（未来は不可）、任意の公演名を足した。会場とアーティストは必須で `restrict`。投稿者と会場は更新できない
- [レポ画像といいねのテーブル](issues/10-report-image-and-like.md) — 画像は変換が終わってから投稿し、行は投稿時に作る（状態は DB に持たず、変換 Lambda は DB に触れない。ADR 0003 を修正）。`app.report_images` は 1 件に最大 4 枚で `position` を持ち、S3 のキーは `id` から組み立てる。`app.likes` は複合主キーで二重いいねを防ぎ、件数は毎回数える。画像もいいねもログインしたユーザーだけで、Go が JWT で確かめる。座席レポを消すと両方 `cascade`
- [IP 単位のカウンタと匿名ユーザーの掃除](issues/11-ip-counter-and-anonymous-cleanup.md) — 投稿の記録を `app.post_logs` に 1 件 1 行で残して数える（スライディング）。IP は鍵付きハッシュ（HMAC-SHA256）だけを持ち 2 日で消す。座席レポのない匿名ユーザーは 30 日で消す。掃除は関数にして pg_cron の 3 つのジョブから呼ぶ。用語を「アーティスト」から「アイドル」に変えた（`app.idols`）
- [読み取りの要件（検索・集計）とインデックス](issues/13-read-requirements-and-indexes.md) — 部分一致用のインデックスも `pg_trgm` も入れず、外部キーのインデックスとシーケンシャルスキャンで済ませる（短い検索語には `pg_trgm` が効かず、データも少ない）。期間は参戦日で絞り込み、コメントのキーワード検索は持つ。会場の平均はファンサを除く 3 軸と件数を毎回 SQL で出す。検索は Go の SQL で行い、DB の関数は作らない。マイグレーションはなし
- [dev への反映と確認](issues/12-apply-to-dev.md) — 9 本を dev に `db push` した（パスワード不要）。無料プランでも pg_cron が通り、ジョブ 3 つ・会場 28 件・アイドル 44 件・全テーブルの RLS を確認。Data API は `anon` で叩いても 503 でデータは返らない。`sekirepo_api` は 6543 番で接続でき、権限どおりに拒否もされた。`config push` は Auth をローカル用の値で上書きするので行わなかった（Data API はすでに無効）。手順は `supabase/README.md`

## Not yet specified

（なし）

## Out of scope

- 会場やアイドルを管理する画面：マスタの追加・修正は seed やマイグレーションの SQL で行う。本番ユーザーがいない今は、作る手間に見合わないため。
- 不適切な座席レポの通報と、管理者による非表示：テーブルも機能も増えるわりに、今は必要がなく、ポートフォリオとしての見せ場にもなりにくいため。必要になったら別の取り組みとして立ち上げる。
- prod の Supabase への反映：CI/CD のマップで扱う。
- 現行の座席レポ 4 件といいね 4 件の移行：参戦日がなく、新しいテーブルの必須の列を埋められないため。必要なら CI/CD のマップで扱う（[座席レポのテーブル](issues/09-seat-report-table.md)で判断）。
