-- アプリのテーブルは public ではなく app スキーマに置く（ADR 0007）
create schema app;

comment on schema app is 'SEKI-REPO のアプリのテーブル。Data API には公開しない';

-- updated_at を持つテーブルに、行の更新時の日時を書き込むトリガー関数
create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
