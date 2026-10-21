-- 現行の本番 DB（re-sekirepo）の応急処置
-- anon キーで全テーブルを書き換えられる状態を塞ぐ。現行のフロントが使っている操作だけを許可する。
-- likes はすでに RLS が有効なので触らない。

begin;

-- test：アプリから使っていないので、ポリシーなし＝すべて拒否
alter table public.test enable row level security;

-- venues：読み取りだけ
alter table public.venues enable row level security;
create policy "venues_select_all" on public.venues for select using (true);

-- artists：読み取りと追加（投稿時に未登録のアーティストを足す）
alter table public.artists enable row level security;
create policy "artists_select_all" on public.artists for select using (true);
create policy "artists_insert_all" on public.artists for insert with check (true);

-- reviews：読み取りは全員。追加はゲスト（user_id が null）か本人。更新・削除は本人だけ
alter table public.reviews enable row level security;
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_guest_or_self" on public.reviews for insert
  with check (user_id is null or user_id = auth.uid());
create policy "reviews_update_own" on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews_delete_own" on public.reviews for delete
  using (user_id = auth.uid());

-- users：読み取りは全員。追加は今までどおり（メール登録の直後はセッションがなく anon で追加するため）。更新・削除は本人だけ
alter table public.users enable row level security;
create policy "users_select_all" on public.users for select using (true);
create policy "users_insert_all" on public.users for insert with check (true);
create policy "users_update_own" on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "users_delete_own" on public.users for delete
  using (id = auth.uid());

commit;

-- 元に戻すとき（問題が起きた場合）：
-- begin;
-- drop policy "venues_select_all" on public.venues;
-- drop policy "artists_select_all" on public.artists;
-- drop policy "artists_insert_all" on public.artists;
-- drop policy "reviews_select_all" on public.reviews;
-- drop policy "reviews_insert_guest_or_self" on public.reviews;
-- drop policy "reviews_update_own" on public.reviews;
-- drop policy "reviews_delete_own" on public.reviews;
-- drop policy "users_select_all" on public.users;
-- drop policy "users_insert_all" on public.users;
-- drop policy "users_update_own" on public.users;
-- drop policy "users_delete_own" on public.users;
-- alter table public.test disable row level security;
-- alter table public.venues disable row level security;
-- alter table public.artists disable row level security;
-- alter table public.reviews disable row level security;
-- alter table public.users disable row level security;
-- commit;
