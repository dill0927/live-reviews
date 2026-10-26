-- プロフィール（表示名とアバター）。Auth のユーザーと 1 対 1 で、匿名ユーザーにも作る
-- 「確認済みか」「匿名か」は Auth の情報（JWT）を正とし、ここには写さない

create table app.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 未設定は null。他の人と同じ名前でもよい
  display_name text check (char_length(display_name) between 1 and 20),
  -- アバターの絵を決める文字列。URL はフロントが組み立てるので、任意の URL は入らない
  avatar_seed text check (char_length(avatar_seed) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.profiles is 'ユーザーが他の人に見せる表示名とアバター。行は auth.users へのトリガーで作る';

create trigger set_updated_at
  before update on app.profiles
  for each row execute function app.set_updated_at();

alter table app.profiles enable row level security;
create policy api_all on app.profiles to sekirepo_api using (true) with check (true);
-- 行の追加はトリガー、削除は auth.users からの cascade で起きるので、Go には読みと 2 列の更新だけを与える
grant select, update (display_name, avatar_seed) on app.profiles to sekirepo_api;

-- Auth がユーザーを作ったら、id だけのプロフィールを作る
-- 失敗するとサインアップごと失敗するので、id を入れる以外のことはしない
-- Auth のロールは app に触れないので、関数の持ち主（postgres）の権限で動かす
create function app.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger create_profile
  after insert on auth.users
  for each row execute function app.create_profile_for_new_user();

-- アイドルを追加したユーザー。運営が入れた公式のものは null、退会しても行は残す
alter table app.idols
  add column created_by uuid references app.profiles (id) on delete set null;
