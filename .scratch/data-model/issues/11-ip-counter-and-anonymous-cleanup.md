# IP 単位のカウンタと匿名ユーザーの掃除

Type: grilling
Status: resolved
Blocked by: 04, 09

## Question

匿名投稿の不正対策の決定（ADR 0005）のうち、DB に置くものを設計してマイグレーションにする。
- 投稿数の制限に使うカウンタ（ユーザー単位と IP 単位）：テーブルの形（時間の区切り方、固定の時間枠かスライディングか）、古い行の掃除、IP アドレスを保存することの扱い（ハッシュ化するか、保持期間）。具体的な制限の数値はバックエンドのマップで決める。
- 匿名ユーザーの掃除：座席レポを 1 件も投稿していない匿名ユーザーを、30 日後に `pg_cron` で削除するジョブ。調査の結果、`pg_cron` が使えない場合の代わり。

補足（Supabase の無料プランで使える機能の調査から）：公式ドキュメントに、古い匿名ユーザーを SQL で消す例がある。auth スキーマ内は cascade で消え、`public` 側は自分で付ける `on delete` 次第。pg_cron は無料プランで使えるとは明記されておらず、dev で実際に確かめる。`cron.job_run_details` の履歴を消すジョブも要る。

補足（「Data API の封鎖と DB ロールの権限」から）：`app` にテーブルを作るときは、RLS の有効化・`sekirepo_api` のポリシー・grant の 3 行を必ず書き（ADR 0008）、`make db-test` で確かめる。

補足（「匿名ユーザーの掃除」向け、「Data API の封鎖と DB ロールの権限」から）：`sekirepo_api` は `auth` に触れないので、`auth.users` の削除は pg_cron のジョブ（`postgres` の権限）で行う。

補足（「ユーザーのプロフィールと認証との紐付け」から）：`auth.users` を消すと `app.profiles` は cascade で消え、座席レポや `artists.created_by` は `set null` になる。掃除の対象は座席レポのない匿名ユーザーなので、掃除で投稿者が null のレポは生まれない。

補足（「座席レポのテーブル」から）：「座席レポのない匿名ユーザー」は `app.seat_reports.user_id` で判定できる（`user_id` にはインデックスがある）。

補足（「レポ画像といいねのテーブル」から）：匿名ユーザーは画像もいいねも付けられないので、掃除の条件は「座席レポがない」だけで足りる。

## Resolution（2026-10-26）

### 決めたこと
- **投稿数の制限は、投稿の記録を 1 件 1 行で残して数える**（スライディング）。固定の時間枠のカウンタは枠の境目をまたぐと 2 倍通り、座席レポのテーブルで数える案は「消して投稿し直す」ですり抜けられ、IP が座席レポと一緒にずっと残るので取らなかった。
- **テーブルは `app.post_logs`**（`id`・`user_id`・`ip_hash`・`created_at`）。Go が座席レポの insert と同じトランザクションで 1 行入れる（成功した投稿だけを記録する。大量のリクエストは CloudFront の WAF と API Gateway で止める）。`user_id` は `app.profiles` を参照し `on delete cascade`。`(user_id, created_at)` と `(ip_hash, created_at)` にインデックス。`sekirepo_api` には `select`・`insert` だけを与えた。
- **数えるのは座席レポの投稿だけ**。アイドルは単独では追加できず、座席レポの投稿時に一緒に追加するので、座席レポの投稿数を制限すればアイドルの追加も制限される。`action` の列は持たない。
- **IP はユーザー単位の制限のすり抜け（匿名ユーザーの作り直し）を防ぐために持つ**。生の IP は持たず、Go が秘密の鍵で計算した HMAC-SHA256 だけを `bytea`（32 バイトの check）で入れる。ただのハッシュは IPv4 の全件を総当たりできるので取らなかった。
- **時間枠は長くても 1 日まで**とし、2 日より古い記録を消す。IP のハッシュの保持期間は 2 日になる。
- **匿名ユーザーの掃除の条件は「匿名・作られて 30 日を過ぎた・座席レポが 0 件」**。最後のログイン日ではなく作られた日で数える（投稿しない匿名ユーザーは残す価値がない）。掃除の瞬間に投稿した場合の競合は、まれなので許容する。
- **掃除の処理は関数にし、pg_cron のジョブからはそれを呼ぶだけ**にした（pgTAP で直接テストできる）。関数は `revoke execute ... from public` で `sekirepo_api` から呼べない。

| 日本時間 | ジョブ | 関数 |
|---|---|---|
| 3:00 | `delete-stale-anonymous-users` | `app.delete_stale_anonymous_users()` |
| 3:10 | `delete-old-post-logs` | `app.delete_old_post_logs()`（2 日より古い記録） |
| 3:20 | `delete-old-cron-run-details` | `app.delete_old_cron_run_details()`（7 日より古い実行履歴） |

- **用語を「アーティスト」から「アイドル」に変えた**。サービスの対象をアイドルのライブに限る（マスタの 44 件もすべてアイドル、「ファンサ」の軸もその前提）。ライブを行う名義（グループ・ソロ・ユニット）を 1 件のアイドルとし、メンバー個人は登録しない。テーブルは `app.idols`、列は `idol_id`。マイグレーションはまだどの Supabase にも反映していないので、新しいマイグレーションを足さず既存のファイルを書き換えた。今のフロント（`frontend/`）と ADR 0007 の旧テーブル名（`artists`）は今の prod のものなので変えていない。

### 書いたもの
- `supabase/migrations/20261026150000_create_post_logs.sql`
- `supabase/migrations/20261026150100_schedule_cleanup_jobs.sql`：`pg_cron` の有効化、3 つの関数とジョブ。
- `supabase/tests/database/post_logs.test.sql`（pgTAP・4 件）：32 バイトでない値は入らない、`sekirepo_api` は読みと追加だけ、ユーザーが消えると記録も消える。
- `supabase/tests/database/cleanup_jobs.test.sql`（pgTAP・9 件）：匿名で投稿なし・31 日前は消え、投稿あり・29 日前・本登録は残る、2 日より古い記録と 7 日より古い実行履歴だけが消える、3 つのジョブが登録されている、`sekirepo_api` は関数を実行できない。
- アイドルへの改名：`20261021120000_create_venues_and_idols.sql`（ファイル名も変更）ほか既存のマイグレーションとテスト、`docs/adr/0009`、`CONTEXT.md`（サービスの説明、アイドル、座席レポ、参戦日、ファンサ）。

### 確かめたこと（ローカル）
- `make db-reset` と `make db-test`（7 ファイル・66 件）が通る。ローカルでは `create extension pg_cron` とジョブの登録が通った。

### 申し送り
- バックエンドのマップへ：制限の件数と時間枠（最長 1 日）、座席レポの insert と記録を同じトランザクションにすること、HMAC の鍵の管理（環境変数。DB とリポジトリには置かない）、IPv6 のまとめ方（`/64` など）、CloudFront 経由で IP をどのヘッダーから取るか、アイドルを座席レポと一緒に追加する API の形、掃除で消えた匿名ユーザーの JWT が期限まで届いたとき（プロフィールがない）の扱い。
- 「dev への反映と確認」へ：dev で `create extension pg_cron` が通り、3 つのジョブが登録されていること。使えなかったら、代わり（GitHub Actions から SQL を流すなど）を新しいチケットにする。
