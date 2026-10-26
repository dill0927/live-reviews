-- レポ画像といいねの制約、座席レポを消したとき・退会したときの挙動、sekirepo_api の権限を確かめる
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-000000000001', false),
  ('00000000-0000-0000-0000-000000000002', false);
insert into app.seat_reports (
  id, user_id, venue_id, idol_id, seat_number, attended_on,
  visibility_rating, fan_service_rating, facilities_rating, access_rating
) values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-000000000001',
  (select id from app.venues limit 1),
  (select id from app.idols limit 1),
  'アリーナ A3 10 列 5 番', '2026-10-01', 4, 3, 3, 2
);

-- レポ画像
select lives_ok(
  $$ insert into app.report_images (id, seat_report_id, position)
     select gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1', p from generate_series(1, 4) p $$,
  '座席レポ 1 件に画像を 4 枚付けられる'
);
select throws_ok(
  $$ insert into app.report_images (id, seat_report_id, position)
     values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1', 5) $$,
  '23514', null, '5 枚目は付けられない'
);
select throws_ok(
  $$ insert into app.report_images (id, seat_report_id, position)
     values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1', 1) $$,
  '23505', null, '同じ並び順の画像は付けられない'
);

-- いいね
insert into app.likes (seat_report_id, user_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002');

select throws_ok(
  $$ insert into app.likes (seat_report_id, user_id)
     values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002') $$,
  '23505', null, '同じユーザーは同じ座席レポに 2 回いいねできない'
);

-- sekirepo_api は作る・消すだけで、更新はできない
grant sekirepo_api to postgres;
set local role sekirepo_api;
do $$
begin
  update app.report_images set position = position;
  perform set_config('test.update_image', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.update_image', 'denied', true);
end;
$$;
do $$
begin
  update app.likes set user_id = user_id;
  perform set_config('test.update_like', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.update_like', 'denied', true);
end;
$$;
delete from app.likes where user_id = '00000000-0000-0000-0000-000000000001';
reset role;

select is(current_setting('test.update_image'), 'denied', 'sekirepo_api はレポ画像を更新できない');
select is(current_setting('test.update_like'), 'denied', 'sekirepo_api はいいねを更新できない');
select is(
  (select count(*) from app.likes), 1::bigint,
  'sekirepo_api はいいねを取り消せる'
);

-- 退会すると、そのユーザーのいいねは消える
delete from auth.users where id = '00000000-0000-0000-0000-000000000002';

select is((select count(*) from app.likes), 0::bigint, '退会するといいねも消える');

-- 座席レポを消すと、画像といいねも消える
insert into app.likes (seat_report_id, user_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001');
delete from app.seat_reports where id = '00000000-0000-0000-0000-0000000000b1';

select is((select count(*) from app.report_images), 0::bigint, '座席レポを消すと画像の行も消える');
select is((select count(*) from app.likes), 0::bigint, '座席レポを消すといいねも消える');

select * from finish();
rollback;
