# ユーザーのプロフィールと認証との紐付け

Type: grilling
Status: resolved
Blocked by: 05

## Question

ユーザーと、Supabase Auth の `auth.users` との関係を決めてテーブルにする。
- プロフィールのテーブル（今の `users`：ユーザー名、アバター）を持つか。持つなら、いつ作るか（サインアップ時のトリガーか、Go の API か）。今ある `confirmed` 列のような状態は要るか。
- 匿名ユーザーにもプロフィールを作るか。本登録（`linkIdentity` など）したとき、何が引き継がれるか（`auth.users` の id は変わらない前提で確かめる）。
- 座席レポなどから、ユーザーをどう参照するか（`auth.users` を直接参照するか、プロフィールのテーブルを参照するか）。
- 退会したとき、そのユーザーの座席レポを消すか残すか（`on delete` の方針）。

補足（「Data API の封鎖と DB ロールの権限」から）：`app` にテーブルを作るときは、RLS の有効化・`sekirepo_api` のポリシー・grant の 3 行を必ず書き（ADR 0008）、`make db-test` で確かめる。

補足（「会場とアーティストのマスタと seed」から）：`app.artists` には、追加したユーザーの列（`created_by`）をまだ作っていない。参照先が決まったら、このチケットのマイグレーションで足し、ユーザーを削除したときの挙動（`on delete set null` など。公式かどうかは `is_official` で持つので、null になっても公式にはならない）を決める。

## Resolution（2026-10-23）

### 決めたこと
- **プロフィールのテーブル `app.profiles` を持つ**。`sekirepo_api` は `auth` に触れない（ADR 0008）ので、Go が座席レポと一緒に投稿者の表示名を返すには `app` 側に要る。名前は `auth.users` と取り違えないよう `profiles` にした。用語集に「プロフィール」と「退会」を足した。
  - 列は `id`（`auth.users(id)` を参照、`on delete cascade`）・`display_name`・`avatar_seed`・`created_at`・`updated_at`。
  - `display_name` は任意（null は未設定）、1〜20 文字、一意にしない。今の「メールアドレスの `@` より前を初期値にする」はメールアドレスの一部を公開することになるのでやめる。null の見せ方は UI/UX のマップで決める。
  - アバターは URL ではなく、絵を決める文字列 `avatar_seed` を持つ。URL を保存すると、API 経由で任意の URL を入れて、閲覧者のブラウザから外部へリクエストを飛ばせてしまう。DiceBear の URL はフロントがシードから組み立てる。画像のアップロードは含めない。
- **`confirmed` は持たない**。「確認済みか」「匿名か」は Auth の情報（JWT）を正とし、プロフィールに写さない（写すとずれる）。
- **行は `auth.users` への insert トリガーで作る**（匿名ユーザーにも作る）。匿名サインインは Go を通らないので、Go で遅れて作る案だと「投稿する人には必ずプロフィールがある」を DB で保証できない。トリガーが失敗するとサインアップごと失敗するので、`id` を入れるだけにした。関数は `security definer`・`search_path = ''`。
- **ユーザーの参照は `app.profiles(id)` に向ける**。外部キーが `app` の中で閉じ、Go は join で表示名を取れる。本登録しても `auth.users` の id は変わらない（公式の Anonymous Sign-Ins）ので、何も書き換えずに引き継がれる。
- **退会しても座席レポは残す（`on delete set null`）**。消える流れは `auth.users` → cascade → `profiles` → set null → 座席レポ。持ち主のいないレポは匿名ユーザーがブラウザのデータを消しても生まれるので、どちらにしても扱いは要る。Go の「自分のレポだけ」は `where user_id = <JWT の id>` なので、null の行に特別な分岐は要らない。`cascade` だと DB の時点で「消す」に固定されるが、`set null` なら Go が先にレポを消せば「消して退会」もできる。退会時に本人に選ばせるかは UI/UX のマップで決める。
- **`app.artists.created_by`** を足した。`app.profiles(id)` を参照し、`on delete set null`。公式のアーティストは null（公式かどうかは `is_official` で持つので、null になっても公式にはならない）。
- **権限**：`sekirepo_api` には `select` と、`display_name`・`avatar_seed` の 2 列だけの `update` を与えた。insert はトリガー、delete は Auth からの cascade で起きる。

### 書いたもの
- `supabase/migrations/20261023090000_create_profiles.sql`：`app.profiles`、`updated_at` のトリガー、ADR 0008 の 3 行、`auth.users` へのトリガー、`app.artists.created_by`。
- `supabase/tests/database/profiles.test.sql`（pgTAP・8 件）：本登録・匿名のどちらでもプロフィールができる、表示名の check、`sekirepo_api` は表示名を更新できるが id の更新と insert はできない、退会でプロフィールが消え `created_by` が null になる。

### 確かめたこと（ローカル）
- `make db-reset` と `make db-test`（32 件）が通る。
- ローカルの Auth の `/auth/v1/signup` でメールのユーザーを作ると、`app.profiles` に行ができる（トリガーは Auth のロールから呼ばれても動く）。ローカルの `config.toml` は `enable_anonymous_sign_ins = false` なので、匿名サインインは Auth 経由では確かめていない（テストでは `is_anonymous = true` の行を直接入れて確かめた）。

### 申し送り
- 「座席レポのテーブル」：投稿者の列は `app.profiles(id)` を参照し、`on delete set null`（null は「退会したユーザー」）。投稿する人には必ずプロフィールの行がある。
- 「IP 単位のカウンタと匿名ユーザーの掃除」：`auth.users` を消すとプロフィールは cascade で消える。掃除の対象は座席レポのない匿名ユーザーだけなので、掃除で null のレポは生まれない。
- 退会の処理（誰が `auth.users` を消すか。`sekirepo_api` は `auth` に触れないので、Go から Auth の管理 API を呼ぶ形が候補）は、バックエンドのマップで決める。
