-- 座席レポの制約、退会時の挙動、sekirepo_api の権限を確かめる
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-000000000001', false);
insert into app.idols (id, name, kana)
  values ('00000000-0000-0000-0000-0000000000a1', 'テストアイドル', 'てすとあいどる');

-- 必須の列だけを埋めた座席レポを作る関数。テストごとに 1 列だけ変えて使う
create function pg_temp.insert_report(
  attended_on date default '2026-10-01',
  fan_service_rating smallint default 3,
  seat_number text default 'アリーナ A3 10 列 5 番'
) returns uuid
language sql
as $$
  insert into app.seat_reports (
    user_id, venue_id, idol_id, seat_number, attended_on,
    visibility_rating, fan_service_rating, facilities_rating, access_rating
  ) values (
    '00000000-0000-0000-0000-000000000001',
    (select id from app.venues limit 1),
    '00000000-0000-0000-0000-0000000000a1',
    seat_number, attended_on, 4, fan_service_rating, 3, 2
  ) returning id;
$$;

select lives_ok($$ select pg_temp.insert_report() $$, '必須の列だけで座席レポを作れる');

select throws_ok(
  $$ select pg_temp.insert_report(fan_service_rating => 0::smallint) $$,
  '23514', null, '評価は 0（未評価）にできない'
);
select throws_ok(
  $$ select pg_temp.insert_report(fan_service_rating => null) $$,
  '23502', null, '4 軸の評価はどれも必須'
);
select throws_ok(
  $$ select pg_temp.insert_report(seat_number => '') $$,
  '23514', null, '座席番号は空文字にできない'
);
select lives_ok(
  $$ select pg_temp.insert_report(attended_on => (now() at time zone 'Asia/Tokyo')::date) $$,
  '日本時間の今日を参戦日にできる'
);
select throws_ok(
  $$ select pg_temp.insert_report(attended_on => (now() at time zone 'Asia/Tokyo')::date + 1) $$,
  '23514', null, '未来の日付は参戦日にできない'
);
select throws_ok(
  $$ delete from app.idols where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23503', null, '座席レポのあるアイドルは消せない'
);

-- sekirepo_api は内容を更新できるが、投稿者と会場は変えられない
grant sekirepo_api to postgres;
set local role sekirepo_api;
update app.seat_reports set seat_number = 'スタンド 2 階 北 23 ゲート';
do $$
begin
  update app.seat_reports set user_id = null;
  perform set_config('test.update_user', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.update_user', 'denied', true);
end;
$$;
do $$
begin
  update app.seat_reports set venue_id = (select id from app.venues offset 1 limit 1);
  perform set_config('test.update_venue', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.update_venue', 'denied', true);
end;
$$;
reset role;

select is(
  (select count(*) from app.seat_reports where seat_number = 'スタンド 2 階 北 23 ゲート'), 2::bigint,
  'sekirepo_api は座席番号を更新できる'
);
select is(current_setting('test.update_user'), 'denied', 'sekirepo_api は投稿者を変えられない');
select is(current_setting('test.update_venue'), 'denied', 'sekirepo_api は会場を変えられない');

-- 退会しても座席レポは残り、投稿者が null になる
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from app.seat_reports where user_id is null), 2::bigint,
  '退会しても座席レポは残り、投稿者が null になる'
);

select * from finish();
rollback;
