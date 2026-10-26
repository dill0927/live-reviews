# 会場とアーティストのマスタと seed

Type: grilling
Status: resolved
Blocked by: 02, 05

## Question

会場とアーティストのテーブルを設計し、退避したデータから seed を作って `make db-reset` で投入できるようにする。
- 会場の列：今の列のうち何を残すか（住所、キャパシティ、画像など）。読み仮名や検索用の列。
- アーティスト：用語集では「公式に登録されたもの」と「投稿者が追加したもの」がある。この区別をどう持つか（フラグ、追加したユーザー）。同じアーティストの重複登録（表記ゆれ）をどう防ぐか。読み仮名（`kana`）。
- seed の形式：SQL（`supabase/seed.sql`）か、CSV を読み込むスクリプトか。dev・prod にも同じ seed を流せるようにする（環境と Terraform state の戦略のルール）。

補足（「Data API の封鎖と DB ロールの権限」から）：`app` にテーブルを作るときは、RLS の有効化・`sekirepo_api` のポリシー・grant の 3 行を必ず書き（ADR 0008）、`make db-test` で確かめる。

## Resolution（2026-10-21）

### 決めたこと
- **会場**（`app.venues`）：`name`・`kana`（新規）・`prefecture`・`venue_type`・`capacity_note`・`access`・`seat_areas`・`website_url`・`image_key`。今の列はすべて残し、用途がわかる名前にそろえた。
  - `venue_type` は `check (in ('stadium', 'dome', 'arena'))`。表示名はフロントで持つ。都道府県には 47 個の check を付けない（運営が SQL で入れるだけなので、seed のレビューで防ぐ）。
  - キャパシティは表示用の文字列 `capacity_note`（例：「55,000人」「6,500〜10,000人」）にした。着席とスタンディングで変わる会場があり、数値 1 つでは表せない。並べ替えや絞り込みの需要も今はない（種別がおおよその規模の目安になる）。必要になったら数値の列を足せばよく、元に戻しやすい。
  - 画像はファイル名だけを `image_key` に持ち、画像がない会場は null。URL の組み立て（フロントの静的ファイルか、S3 に移すか）はこのマップでは決めない。
- **アーティスト**（`app.artists`）：`name`・`kana`・`is_official`。
  - 公式かどうかは `is_official boolean not null default false` で持つ。`created_by is null` を公式とみなす案は、ユーザーを削除すると公式に「昇格」してしまうので採らなかった。投稿者の追加を既定にし、運営が入れるときだけ `true` を書く。
  - `created_by` は、参照先（`auth.users` かプロフィールのテーブルか）と削除時の挙動が「ユーザーのプロフィールと認証との紐付け」で決まるので、このチケットでは作らない。
  - 重複登録は、`lower(normalize(name, NFKC))` の一意インデックスで、全角と半角・大文字と小文字の違いだけのものを防ぐ。「キスマイ」と「Kis-My-Ft2」のような別名は DB では防げないので、投稿画面の候補表示に任せる（UI/UX のマップ）。`kana` は同じ読みの別アーティストがありえるので一意にしない。
  - `gender` は使っていないので削除した。
- **読み仮名**：会場とアーティストの両方で `not null`、ひらがなと長音だけ（`^[ぁ-ゖー]+$`）。並べ替えと検索の土台にする。投稿者がアーティストを追加するときにも入力してもらう。
- **権限**：`sekirepo_api` には、会場は `select` だけ、アーティストは `select, insert` だけを与えた。修正と削除は運営が SQL で行う。
- **マスタのデータはマイグレーションで入れる**（[ADR 0009](../../../docs/adr/0009-master-data-in-migrations.md)）。`db push` するだけでローカル・dev・prod に同じデータが入る。`seed.sql` はローカル専用のダミーデータの置き場にする（まだ作っていない。`db reset` で「no files matched」と出るのはそのため）。
- **データの引き継ぎ**：ID は現行のものを保つ（照らし合わせやすいため）。誤りを直した：TREAURE → TREASURE、LaLa arena TOKYO-BAY の都道府県（東京都 → 千葉県）、セキスイハイムスーパーアリーナの画像（`no_image.jpg` → 実在する画像）、国立競技場のアクセスに混入していた BOM（U+FEFF）。投稿者が追加した 2 件のうち、実在の「HiHi Jets」は公式にし、特定のアーティストを指さない「ジュニア」は入れなかった。会場 28 件、アーティスト 44 件。

### 書いたもの
- `supabase/migrations/20261021120000_create_venues_and_artists.sql`：2 つのテーブル、`updated_at` のトリガー、ADR 0008 の 3 行。
- `supabase/migrations/20261021120100_insert_master_data.sql`：初期データ。退避した `backup/master-data.sql` からスクリプトで生成した（読み仮名の付与とデータの修正もここで行った）。
- `supabase/tests/database/master.test.sql`（pgTAP・10 件）：件数、表記ゆれの一意制約、読み仮名と種別の check、`is_official` の既定値、`sekirepo_api` の権限、`updated_at` のトリガー。
- `supabase/tests/database/api_role.test.sql`：「select・insert・delete を持つ」というテストは、`has_table_privilege` に複数の権限を渡すと「どれか 1 つを持てば true」になるため、実際には select だけを確かめていた。読むだけのテーブルもあるので、説明と条件を「select を持つ」に合わせた。

### 確かめたこと（ローカル）
- `make db-reset` と `make db-test`（24 件）が通る。
- `sekirepo_api` / `local-only` で接続すると、`venues` は読めて、`insert` は `permission denied for table venues` になる。

### 申し送り
- 「ユーザーのプロフィールと認証との紐付け」：`app.artists` に `created_by`（追加したユーザー）を足し、ユーザーを削除したときの挙動を決める。
- 「dev への反映と確認」：マスタはマイグレーションで入るので、`db push` だけで会場 28 件・アーティスト 44 件が入ることを確かめる（`--include-seed` は使わない）。
- Not yet specified の「読み取りの要件」：会場とアーティストの検索（`kana` を使うか、`pg_trgm` を入れるか）とインデックスはそちらで決める。
