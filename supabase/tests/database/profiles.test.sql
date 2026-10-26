-- プロフィールの自動作成、退会時の挙動、sekirepo_api の権限を確かめる
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Auth がユーザーを作ると、プロフィールが 1 行できる（匿名ユーザーでも）
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-000000000001', false),
  ('00000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from app.profiles where id = '00000000-0000-0000-0000-000000000001'), 1::bigint,
  '本登録のユーザーを作ると、プロフィールができる'
);
select is(
  (select count(*) from app.profiles where id = '00000000-0000-0000-0000-000000000002'), 1::bigint,
  '匿名ユーザーを作っても、プロフィールができる'
);

select throws_ok(
  $$ update app.profiles set display_name = '' where id = '00000000-0000-0000-0000-000000000001' $$,
  '23514', null, '表示名は空文字にできない'
);

-- sekirepo_api は表示名とアバターだけを更新でき、id は変えられない
grant sekirepo_api to postgres;
set local role sekirepo_api;
update app.profiles set display_name = 'テストユーザー' where id = '00000000-0000-0000-0000-000000000001';
do $$
begin
  update app.profiles set id = gen_random_uuid() where id = '00000000-0000-0000-0000-000000000001';
  perform set_config('test.update_id', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.update_id', 'denied', true);
end;
$$;
do $$
begin
  insert into app.profiles (id) values (gen_random_uuid());
  perform set_config('test.insert', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.insert', 'denied', true);
end;
$$;
reset role;

select is(
  (select display_name from app.profiles where id = '00000000-0000-0000-0000-000000000001'), 'テストユーザー',
  'sekirepo_api は表示名を更新できる'
);
select is(current_setting('test.update_id'), 'denied', 'sekirepo_api は id を更新できない');
select is(current_setting('test.insert'), 'denied', 'sekirepo_api はプロフィールを直接作れない');

-- 退会（auth.users の削除）すると、プロフィールは消え、追加したアイドルは残る
insert into app.idols (name, kana, created_by)
  values ('テストアイドル', 'てすとあいどる', '00000000-0000-0000-0000-000000000001');
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from app.profiles where id = '00000000-0000-0000-0000-000000000001'), 0::bigint,
  '退会すると、プロフィールが消える'
);
select is(
  (select created_by from app.idols where name = 'テストアイドル'), null::uuid,
  '退会しても、追加したアイドルは残り、created_by が null になる'
);

select * from finish();
rollback;
