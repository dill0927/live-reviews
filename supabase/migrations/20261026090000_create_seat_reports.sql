-- 座席レポ。1 回の参戦体験の記録で、4 軸評価（見やすさ・ファンサ・周辺施設・アクセス）とそのコメントを持つ

create table app.seat_reports (
  id uuid primary key default gen_random_uuid(),
  -- null は「退会したユーザー」。退会しても座席レポは残す
  user_id uuid references app.profiles (id) on delete set null,
  -- 座席レポのある会場とアイドルは消せない
  venue_id uuid not null references app.venues (id) on delete restrict,
  idol_id uuid not null references app.idols (id) on delete restrict,
  -- 会場や公演によって座席の呼び方が違いすぎるので、構造化せず自由入力で持つ
  seat_number text not null check (char_length(seat_number) between 1 and 50),
  -- 「今日以前」は一度通れば通り続けるので、復元しても失敗しない。DB は UTC なので日本時間の日付で比べる
  attended_on date not null check (
    attended_on >= '2000-01-01' and attended_on <= (now() at time zone 'Asia/Tokyo')::date
  ),
  show_title text check (char_length(show_title) between 1 and 100),
  visibility_rating smallint not null check (visibility_rating between 1 and 5),
  visibility_comment text check (char_length(visibility_comment) between 1 and 1000),
  fan_service_rating smallint not null check (fan_service_rating between 1 and 5),
  fan_service_comment text check (char_length(fan_service_comment) between 1 and 1000),
  facilities_rating smallint not null check (facilities_rating between 1 and 5),
  facilities_comment text check (char_length(facilities_comment) between 1 and 1000),
  access_rating smallint not null check (access_rating between 1 and 5),
  access_comment text check (char_length(access_comment) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.seat_reports is '座席レポ。匿名ユーザーの投稿も同じテーブルに入り、匿名かどうかは Auth の情報で判断する';

-- 外部キーにはインデックスが自動で付かない。会場ページの一覧・マイページと、退会時の set null で使う
create index seat_reports_venue_id_idx on app.seat_reports (venue_id);
create index seat_reports_idol_id_idx on app.seat_reports (idol_id);
create index seat_reports_user_id_idx on app.seat_reports (user_id);

create trigger set_updated_at
  before update on app.seat_reports
  for each row execute function app.set_updated_at();

alter table app.seat_reports enable row level security;
create policy api_all on app.seat_reports to sekirepo_api using (true) with check (true);
-- 投稿者のすり替えと、会場の付け替えはできないようにする（会場を間違えたら消して投稿し直す）
grant select, insert, delete on app.seat_reports to sekirepo_api;
grant update (
  seat_number, idol_id, attended_on, show_title,
  visibility_rating, visibility_comment,
  fan_service_rating, fan_service_comment,
  facilities_rating, facilities_comment,
  access_rating, access_comment
) on app.seat_reports to sekirepo_api;
