-- レポ画像といいね。どちらも座席レポにぶら下がり、行を作るか消すかだけで更新はしない
-- 更新しないので、規約の updated_at は持たない（持っても常に created_at と同じになる）

-- レポ画像。変換が終わってから投稿するので、行は「変換済みの画像」だけを表す（ADR 0003）
-- 「ログインしたユーザーだけが付けられる」は Go が JWT で確かめる。匿名かどうかは Auth を正とし、DB には写さない
create table app.report_images (
  -- S3 のキーはこの id から規則で組み立てる。presigned POST の発行時に Go が決める
  id uuid primary key,
  seat_report_id uuid not null references app.seat_reports (id) on delete cascade,
  -- 1 回の投稿で同時に作るので、created_at では並び順を決められない
  position smallint not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  -- 並び順の重複を防ぎ、1 件の座席レポに 5 枚目が入らないことも保証する
  unique (seat_report_id, position)
);

comment on table app.report_images is 'レポ画像。座席レポ 1 件に最大 4 枚。S3 のファイルは Go が DB の行を消したあとで消す';

alter table app.report_images enable row level security;
create policy api_all on app.report_images to sekirepo_api using (true) with check (true);
-- 並べ替えや付け外しは、そのレポの行を消して入れ直すので update は与えない
grant select, insert, delete on app.report_images to sekirepo_api;

-- いいね。「誰が・どの座席レポに」の組そのものが中身なので、uuid の id は持たず複合主キーにする
-- 匿名ユーザーは付けられない（Go が JWT で確かめる）。件数は持たず、毎回数える
create table app.likes (
  seat_report_id uuid references app.seat_reports (id) on delete cascade,
  -- 退会したら消す。投稿者のいないいいねには意味がない
  user_id uuid references app.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 二重いいねを防ぎ、座席レポごとの件数を数えるインデックスも兼ねる
  primary key (seat_report_id, user_id)
);

comment on table app.likes is 'いいね。ユーザーが座席レポに 1 回だけ付けられる';

-- 主キーは seat_report_id が先頭なので、退会時の cascade とマイページ用に別に付ける
create index likes_user_id_idx on app.likes (user_id);

alter table app.likes enable row level security;
create policy api_all on app.likes to sekirepo_api using (true) with check (true);
grant select, insert, delete on app.likes to sekirepo_api;
