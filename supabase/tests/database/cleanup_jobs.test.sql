-- 掃除の関数が消すもの・残すもの、ジョブの登録、sekirepo_api から呼べないことを確かめる
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- 匿名ユーザーの掃除
insert into auth.users (id, is_anonymous, created_at) values
  ('00000000-0000-0000-0000-000000000001', true, now() - interval '31 days'),
  ('00000000-0000-0000-0000-000000000002', true, now() - interval '31 days'),
  ('00000000-0000-0000-0000-000000000003', true, now() - interval '29 days'),
  ('00000000-0000-0000-0000-000000000004', false, now() - interval '31 days');
insert into app.seat_reports (
  user_id, venue_id, idol_id, seat_number, attended_on,
  visibility_rating, fan_service_rating, facilities_rating, access_rating
) values (
  '00000000-0000-0000-0000-000000000002',
  (select id from app.venues limit 1),
  (select id from app.idols limit 1),
  'アリーナ A3 10 列 5 番', '2026-10-01', 4, 3, 3, 2
);

select app.delete_stale_anonymous_users();

select ok(
  not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000001'),
  '座席レポのない、30 日を過ぎた匿名ユーザーは消える'
);
select ok(
  exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000002'),
  '座席レポのある匿名ユーザーは残る'
);
select ok(
  exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000003'),
  '30 日を過ぎていない匿名ユーザーは残る'
);
select ok(
  exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000004'),
  '本登録したユーザーは残る'
);

-- 投稿の記録の掃除
insert into app.post_logs (user_id, ip_hash, created_at) values
  ('00000000-0000-0000-0000-000000000002', extensions.digest('203.0.113.1', 'sha256'), now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000002', extensions.digest('203.0.113.1', 'sha256'), now() - interval '1 day');

select app.delete_old_post_logs();

select is(
  (select count(*) from app.post_logs where created_at < now() - interval '2 days'), 0::bigint,
  '2 日より古い記録は消える'
);
select is(
  (select count(*) from app.post_logs where created_at >= now() - interval '2 days'), 1::bigint,
  '2 日以内の記録は残る'
);

-- 実行履歴の掃除
insert into cron.job_run_details (jobid, runid, status, start_time, end_time) values
  (1, 900001, 'succeeded', now() - interval '8 days', now() - interval '8 days'),
  (1, 900002, 'succeeded', now() - interval '6 days', now() - interval '6 days');

select app.delete_old_cron_run_details();

select is(
  (select array_agg(runid) from cron.job_run_details where runid in (900001, 900002)), array[900002::bigint],
  '7 日より古い実行履歴だけが消える'
);

-- ジョブの登録
select set_eq(
  $$ select jobname, schedule, command from cron.job $$,
  $$ values
     ('delete-stale-anonymous-users', '0 18 * * *', 'select app.delete_stale_anonymous_users()'),
     ('delete-old-post-logs', '10 18 * * *', 'select app.delete_old_post_logs()'),
     ('delete-old-cron-run-details', '20 18 * * *', 'select app.delete_old_cron_run_details()') $$,
  '3 つのジョブが日本時間の深夜に登録されている'
);

-- sekirepo_api から呼べない
select ok(
  not has_function_privilege('sekirepo_api', 'app.delete_stale_anonymous_users()', 'execute')
    and not has_function_privilege('sekirepo_api', 'app.delete_old_post_logs()', 'execute')
    and not has_function_privilege('sekirepo_api', 'app.delete_old_cron_run_details()', 'execute'),
  'sekirepo_api は掃除の関数を実行できない'
);

select * from finish();
rollback;
