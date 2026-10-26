-- Go の API が接続する専用のロール（ADR 0008）
-- パスワードはリポジトリに書かない。ローカルは make db-reset で、dev / prod は SQL エディタで設定する
create role sekirepo_api login;

comment on role sekirepo_api is 'Go の API が Supavisor 経由で接続するロール。app のテーブルの読み書きだけを持つ';

grant usage on schema app to sekirepo_api;
alter role sekirepo_api set search_path = app;

-- app にテーブルを作るときは、次の 3 つを必ず書く（supabase/tests で確かめる）
--   alter table app.xxx enable row level security;
--   create policy api_all on app.xxx to sekirepo_api using (true) with check (true);
--   grant <必要な操作だけ> on app.xxx to sekirepo_api;   -- 例：select, insert
