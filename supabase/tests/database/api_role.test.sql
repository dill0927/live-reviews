-- Data API の封鎖と、Go の API のロール（sekirepo_api）の権限を確かめる（ADR 0002・0007・0008）
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Data API のロールは app に触れない
select ok(not has_schema_privilege('anon', 'app', 'usage'), 'anon は app の usage を持たない');
select ok(not has_schema_privilege('authenticated', 'app', 'usage'), 'authenticated は app の usage を持たない');

-- sekirepo_api は app のテーブルの読み書きだけを持つ
select ok(has_schema_privilege('sekirepo_api', 'app', 'usage'), 'sekirepo_api は app の usage を持つ');
select ok(not has_schema_privilege('sekirepo_api', 'app', 'create'), 'sekirepo_api は app にオブジェクトを作れない');
select ok(not has_schema_privilege('sekirepo_api', 'public', 'create'), 'sekirepo_api は public にオブジェクトを作れない');
select ok(not has_schema_privilege('sekirepo_api', 'auth', 'usage'), 'sekirepo_api は auth に触れない');
select is_empty(
  $$ select rolname from pg_roles
     where rolname = 'sekirepo_api'
       and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb) $$,
  'sekirepo_api は管理者の属性も bypassrls も持たない'
);
select ok(
  exists (
    select from pg_db_role_setting
    where setrole = 'sekirepo_api'::regrole and 'search_path=app' = any(setconfig)
  ),
  'sekirepo_api の search_path は app'
);

-- app の全テーブルが「RLS・sekirepo_api のポリシー・grant」の 3 つをそろえている
select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'app'::regnamespace and c.relkind = 'r' and not c.relrowsecurity $$,
  'app の全テーブルで RLS が有効'
);
select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'app'::regnamespace and c.relkind = 'r'
       and not exists (
         select from pg_policies p
         where p.schemaname = 'app' and p.tablename = c.relname and 'sekirepo_api' = any(p.roles)
       ) $$,
  'app の全テーブルに sekirepo_api のポリシーがある'
);
select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'app'::regnamespace and c.relkind = 'r'
       and not has_table_privilege('sekirepo_api', c.oid, 'select') $$,
  'app の全テーブルで sekirepo_api が select を持つ（書き込みの権限はテーブルごとに決める）'
);
select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'app'::regnamespace and c.relkind = 'r'
       and (has_table_privilege('anon', c.oid, 'select, insert, update, delete')
         or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete')) $$,
  'app のどのテーブルにも anon・authenticated の権限がない'
);

-- テーブルを作るときの 3 行の決まりどおりに作ると、sekirepo_api だけが読み書きできる
create table app.template_check (id uuid primary key default gen_random_uuid());
alter table app.template_check enable row level security;
create policy api_all on app.template_check to sekirepo_api using (true) with check (true);
grant select, insert, update, delete on app.template_check to sekirepo_api;
grant usage on schema app to authenticated;
grant select on app.template_check to authenticated;

-- ロールを作った postgres も、Postgres 16 からは明示しないと set role できない（rollback で消える）
grant sekirepo_api to postgres;
-- sekirepo_api は pgTAP（extensions）に触れないので、件数だけ取っておき、ロールを戻してから確かめる
set local role sekirepo_api;
insert into app.template_check default values;
select set_config('test.api_count', (select count(*) from app.template_check)::text, true);

set local role authenticated;
select set_config('test.authenticated_count', (select count(*) from app.template_check)::text, true);
reset role;

select is(current_setting('test.api_count'), '1', 'sekirepo_api は app のテーブルに書けて、読める');
select is(current_setting('test.authenticated_count'), '0', '誤って grant しても、ポリシーがないロールには 1 行も見えない');

select * from finish();
rollback;
