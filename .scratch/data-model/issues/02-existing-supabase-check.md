# 既存の Supabase プロジェクトの確認とマスタの退避

Type: task（HITL）
Status: resolved
Blocked by:

## Question

今の Supabase プロジェクトについて、次の事実を確かめて記録する。
- リージョンが東京（ap-northeast-1）か（環境と Terraform state の戦略の申し送り）
- JWT の署名鍵が非対称鍵（ES256）か、HS256 のままか（JWT の検証場所の申し送り）
- 会場とアーティストのマスタ（`venues`・`artists`）の件数と列

そのうえで、prod を作り直すことになっても困らないように、会場とアーティストのデータを取り出してリポジトリの外（または seed の元データとしてリポジトリ内）に退避する。取り出し方（管理画面の CSV 出力、`pg_dump` など）と保存場所を記録する。

## Resolution（2026-10-21）

### 確かめた事実
- 今のアプリが使っているのは **re-sekirepo**（ref `focxwgezeedvyphcqghf`、Postgres 17）。Vercel の `NEXT_PUBLIC_SUPABASE_URL` で確認した。
- 同じ組織に、一時停止中の古いプロジェクト **live-reviews**（ref `dijapmjyqzdspjwdxyge`、Postgres 15、INACTIVE）もある。アプリからは使っていない。
- リージョン：どちらも **東京（ap-northeast-1）**。prod を作り直す必要はない。
- JWT の署名鍵：**HS256 のまま**。`/auth/v1/.well-known/jwks.json` が `{"keys":[]}` を返し、ダッシュボードにも Legacy JWT secret が残っている。prod では非対称鍵への移行が必要（「dev と prod の Supabase プロジェクトの用意」で行う）。
- `public` のテーブル：`venues`・`artists`・`reviews`・`likes`・`users` と、使っていない `test`。件数は venues 28、artists 45（うち投稿者が追加した `is_official = false` が 2 件）、reviews 4、users 3、likes 4。
- 列の要点（会場とアーティストのマスタの材料）：
  - `venues`：`name`・`image_url`・`capacity`（text）・`access`・`seat`・`website`・`type`・`prefecture`
  - `artists`：`name`・`kana`・`is_official`（既定値 true）・`created_by`（外部キーなし）・`gender`（`male`/`female` の CHECK）
  - `search_venues` は `pg_trgm` の `similarity()` を使っている。
  - 時刻の列は `timestamp without time zone`。

### 退避
- `supabase db dump`（Supabase CLI。Docker のコンテナ内の `pg_dump` で取り出す。ログイン済みなら一時的なロールで接続し、DB パスワードは不要だった）で、次の 2 つを取り出した。
  - [public-schema.sql](../backup/public-schema.sql)：public スキーマの定義
  - [master-data.sql](../backup/master-data.sql)：`venues` と `artists` のデータだけ（`-x public.reviews,public.likes,public.users,public.test` で個人のデータを除いた）
- どちらも公開情報なので、リポジトリの `.scratch/data-model/backup/` に置く。seed の形式は「会場とアーティストのマスタと seed」で決める。

### ついでに行った応急処置
- dump から、`anon` に全テーブルの `GRANT ALL` が付き、RLS が `likes` 以外で無効、つまり anon キーで誰でも全データを書き換えられる状態だと分かった。
- 現行のフロントが使う操作だけを許可する RLS を、本番に SQL Editor で適用した（[current-prod-rls.sql](../../hotfix/current-prod-rls.sql)。末尾に元に戻す SQL がある）。anon キーで、全テーブルが読めること・`search_venues` が動くこと・reviews を更新できないことを確かめた。
- 残っている既存のバグ（リプレイスで作り直すので直さない）：`likes` に削除のポリシーがなく、いいねの取り消しが DB では失敗している。`sitemap.ts` が存在しない `updated_at` を読んでいる。
