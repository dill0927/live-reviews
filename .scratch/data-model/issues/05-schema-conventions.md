# スキーマ全体の規約

Type: grilling
Status: resolved
Blocked by: 01, 04

## Question

すべてのテーブルに共通する規約を決め、最初のマイグレーション（拡張機能の有効化、共通の関数など）を書く。
- テーブルを置くスキーマ：`public` か、アプリ専用のスキーマ（例：`app`）か。Data API の封鎖のしやすさ（調査の結果）とあわせて決める。
- 名前の付け方：用語集に合わせる（例：座席レポは `seat_reports`）。複数形か単数形か。
- ID の型：`uuid`（v4 / v7）か、`bigint` の identity か。URL に出る ID かどうかも考える。
- `created_at` / `updated_at` の持ち方と、`updated_at` を自動で更新するトリガー。
- 削除の方針：物理削除か論理削除（`deleted_at`）か。
- 文字列の長さなどの制約を DB の `check` で持つか、Go の検証だけにするか。

補足（Supabase の無料プランで使える機能の調査から）：マイグレーションで作ったテーブルは RLS が既定で無効。`ensure_rls` のイベントトリガーを入れるか、マイグレーションごとに明示するかは、ここか「Data API の封鎖と DB ロールの権限」で決める。2026-10-30 以降、`public` の新しいテーブルは anon などに自動で grant されなくなる。

## Resolution（2026-10-21）

### 決めた規約
- **スキーマ**：テーブルは `app` スキーマに置く（[ADR 0007](../../../docs/adr/0007-app-schema-instead-of-public.md)）。prod の `public` に残る現行のテーブルと並べて置けて、Data API にも最初から公開されないため。
- **名前**：テーブル名は複数形の snake_case。用語集の英語名から作る（SeatReport → `seat_reports`）。列名も snake_case。
- **ID**：全テーブルで `uuid`。既定値は `gen_random_uuid()`（v4）。URL に出しても総数がわからず、番号を順にたどられることもない。v7 の生成関数（`uuidv7()`）は Postgres 18 からだが、2026-10-21 の時点で Supabase は 18 に未対応（クラウドもローカルの CLI 2.121.0 も 17 まで）。18 に上げたら既定値を `uuidv7()` に変えるだけでよく、既存のデータには手を入れなくてよい。
- **時刻**：型は `timestamptz`（現行の `timestamp without time zone` はやめる）。`created_at timestamptz not null default now()` を全テーブルに付ける。`updated_at` は更新される行を持つテーブルだけに付け、トリガー関数 `app.set_updated_at()` で更新する（`before update ... for each row`）。作成と削除しかされないテーブル（いいねなど）には付けない。
- **削除**：物理削除。論理削除は、すべてのクエリとユニーク制約に条件が要るうえ、通報や非表示の機能を対象外にしたので復元の需要もない。消したときに関連する行をどうするか（`on delete` を cascade にするか restrict にするか）は、外部キーごとに各テーブルのチケットで決める。
- **値の制約**：範囲・選択肢・空文字の禁止・長さの上限は、OpenAPI と DB の `check` の両方に**同じ値で**書く。OpenAPI を通らずに書き込む経路（画像変換の Lambda、seed や手書きの SQL、pg_cron のジョブ、データの移行）があるため。使い分けるより、全部両方に書くほうがルールとして単純。値を変えるときは、2 か所を同じ PR で変える。DB のほうが厳しくなると、利用者に 400 ではなく 500 が返るため。
- **型**：文字列は `text` に `check (char_length(x) <= n)` を付ける（`varchar(n)` は使わない）。選択肢は `text` に `check (x in (...))` を付ける（`enum` 型は値の削除や並べ替えが難しいため使わない）。
- **拡張機能**：最初のマイグレーションではまとめて入れない。使うチケットのマイグレーションで入れる（`pg_trgm` は会場の検索、`pg_cron` は匿名ユーザーの掃除）。

### 書いたもの
- `supabase/migrations/20261021084840_create_app_schema.sql`：`app` スキーマと `app.set_updated_at()`（`set search_path = ''` を付けた）。
- `make db-reset` で適用できることを確かめた。トランザクションの中で仮のテーブルを作り、更新すると `updated_at` だけが新しくなることを確かめた（確認後にロールバックした）。`anon`・`authenticated` は `app` の usage を持たない。

### 回したこと
- RLS を全テーブルで有効にする仕組み（`ensure_rls` のイベントトリガーか、マイグレーションごとに明示するか）は、Go の接続ロールの権限と切り離せないので、「Data API の封鎖と DB ロールの権限」で決める。
