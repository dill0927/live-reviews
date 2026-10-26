-- 毎日の深夜に古いデータを消す pg_cron のジョブ
-- 処理は関数にしておき、pgTAP から直接呼んで確かめる。ジョブは postgres の権限で関数を呼ぶだけ
create extension if not exists pg_cron with schema pg_catalog;

-- 座席レポを 1 件も投稿しないまま 30 日たった匿名ユーザーを消す（ADR 0005）
-- 匿名ユーザーはいいねも画像も付けられないので、座席レポがないことだけを確かめればよい
-- app.profiles と app.post_logs は cascade で消え、追加したアイドルの created_by は null になる
create function app.delete_stale_anonymous_users()
returns void
language sql
set search_path = ''
as $$
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '30 days'
    and not exists (select 1 from app.seat_reports r where r.user_id = u.id);
$$;

-- 投稿数の制限の時間枠は長くても 1 日なので、1 日の余裕を持たせて 2 日より古い記録を消す
create function app.delete_old_post_logs()
returns void
language sql
set search_path = ''
as $$
  delete from app.post_logs where created_at < now() - interval '2 days';
$$;

-- pg_cron の実行履歴は自動では消えないので、7 日分だけ残す
create function app.delete_old_cron_run_details()
returns void
language sql
set search_path = ''
as $$
  delete from cron.job_run_details where end_time < now() - interval '7 days';
$$;

-- 関数は既定で誰でも実行できるので、sekirepo_api から呼べないようにする
revoke execute on function app.delete_stale_anonymous_users() from public;
revoke execute on function app.delete_old_post_logs() from public;
revoke execute on function app.delete_old_cron_run_details() from public;

-- 時刻は UTC。日本時間の 3:00・3:10・3:20 に、同時に動かないようずらして動かす
select cron.schedule('delete-stale-anonymous-users', '0 18 * * *', 'select app.delete_stale_anonymous_users()');
select cron.schedule('delete-old-post-logs', '10 18 * * *', 'select app.delete_old_post_logs()');
select cron.schedule('delete-old-cron-run-details', '20 18 * * *', 'select app.delete_old_cron_run_details()');
