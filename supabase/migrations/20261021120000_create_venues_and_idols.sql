-- 会場とアイドルのマスタ（データは次のマイグレーションで入れる。ADR 0009）
-- 会場は運営が SQL で入れるだけなので、Go の API には select だけを与える

create table app.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  kana text not null check (char_length(kana) <= 100 and kana ~ '^[ぁ-ゖー]+$'),
  prefecture text not null check (char_length(prefecture) between 1 and 10),
  venue_type text not null check (venue_type in ('stadium', 'dome', 'arena')),
  -- 着席とスタンディングで変わるなど、数値 1 つでは表せないので表示用の文章で持つ
  capacity_note text check (char_length(capacity_note) between 1 and 100),
  access text check (char_length(access) between 1 and 500),
  seat_areas text check (char_length(seat_areas) between 1 and 500),
  website_url text check (char_length(website_url) <= 500 and website_url ~ '^https?://'),
  -- 画像のファイル名だけを持ち、URL の組み立ては呼び出す側に任せる
  image_key text check (char_length(image_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.venues is '会場のマスタ。運営がマイグレーションで追加・修正する';

create trigger set_updated_at
  before update on app.venues
  for each row execute function app.set_updated_at();

alter table app.venues enable row level security;
create policy api_all on app.venues to sekirepo_api using (true) with check (true);
grant select on app.venues to sekirepo_api;

create table app.idols (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  kana text not null check (char_length(kana) <= 100 and kana ~ '^[ぁ-ゖー]+$'),
  -- 投稿者が追加するのを既定にし、運営が入れるときだけ true を書く
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.idols is 'アイドル。公式に登録されたものと、投稿者が追加したものがある';

-- 全角と半角、大文字と小文字の違いだけの重複登録を防ぐ（「ＷＥＳＴ」と「west」は同じ）
create unique index idols_normalized_name_key on app.idols (lower(normalize(name, NFKC)));

create trigger set_updated_at
  before update on app.idols
  for each row execute function app.set_updated_at();

alter table app.idols enable row level security;
create policy api_all on app.idols to sekirepo_api using (true) with check (true);
-- 投稿者は追加だけができ、修正と削除は運営が SQL で行う
grant select, insert on app.idols to sekirepo_api;
