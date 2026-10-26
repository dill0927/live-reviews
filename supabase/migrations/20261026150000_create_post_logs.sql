-- 投稿の記録。投稿数の制限（ユーザー単位と IP 単位）を Go が判断するためだけに使う（ADR 0005）
-- 座席レポを消しても記録は残るので、「消して投稿し直す」で制限をすり抜けられない
-- アイドルの追加は座席レポの投稿に含まれるので、数えるのは座席レポの投稿だけ
create table app.post_logs (
  id uuid primary key default gen_random_uuid(),
  -- 退会や匿名ユーザーの掃除で消えたら、記録も要らない
  user_id uuid not null references app.profiles (id) on delete cascade,
  -- 生の IP は持たない。Go が秘密の鍵で計算した HMAC-SHA256（32 バイト）だけを入れる
  ip_hash bytea not null check (octet_length(ip_hash) = 32),
  created_at timestamptz not null default now()
);

comment on table app.post_logs is '座席レポを投稿した記録。Go が座席レポの insert と同じトランザクションで入れ、2 日たったら cron のジョブで消す';

-- 「直近の一定時間に何件か」をユーザー単位と IP 単位で数える。user_id の方は退会時の cascade も兼ねる
create index post_logs_user_id_created_at_idx on app.post_logs (user_id, created_at);
create index post_logs_ip_hash_created_at_idx on app.post_logs (ip_hash, created_at);

alter table app.post_logs enable row level security;
create policy api_all on app.post_logs to sekirepo_api using (true) with check (true);
-- 古い行の削除は cron のジョブが行うので、Go には読みと追加だけを与える
grant select, insert on app.post_logs to sekirepo_api;
