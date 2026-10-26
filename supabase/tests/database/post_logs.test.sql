-- 投稿の記録の制約、退会したときの挙動、sekirepo_api の権限を確かめる
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into app.post_logs (user_id, ip_hash)
     values ('00000000-0000-0000-0000-000000000001', extensions.digest('203.0.113.1', 'sha256')) $$,
  '32 バイトのハッシュで記録を入れられる'
);
select throws_ok(
  $$ insert into app.post_logs (user_id, ip_hash)
     values ('00000000-0000-0000-0000-000000000001', convert_to('203.0.113.1', 'UTF8')) $$,
  '23514', null, '32 バイトでない値（生の IP など）は入れられない'
);

select ok(
  has_table_privilege('sekirepo_api', 'app.post_logs', 'select')
    and has_table_privilege('sekirepo_api', 'app.post_logs', 'insert')
    and not has_table_privilege('sekirepo_api', 'app.post_logs', 'update')
    and not has_table_privilege('sekirepo_api', 'app.post_logs', 'delete'),
  'sekirepo_api は記録を読むことと入れることだけができる'
);

delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from app.post_logs), 0::bigint,
  'ユーザーが消えると記録も消える'
);

select * from finish();
rollback;
