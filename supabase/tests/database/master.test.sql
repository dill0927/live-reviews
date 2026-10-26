-- 会場とアイドルのマスタの初期データと制約、sekirepo_api の権限を確かめる
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select is((select count(*) from app.venues), 28::bigint, '会場の初期データが 28 件入っている');
select is((select count(*) from app.idols where is_official), 44::bigint, '公式のアイドルが 44 件入っている');

-- 全角と半角、大文字と小文字の違いだけの重複は登録できない
select throws_ok(
  $$ insert into app.idols (name, kana) values ('ＳＮＯＷ ＭＡＮ', 'すのーまん') $$,
  '23505', null, '表記ゆれ（全角・大文字）の重複は一意制約で弾かれる'
);
select lives_ok(
  $$ insert into app.idols (name, kana) values ('すのーまん', 'すのーまん') $$,
  '読みが同じでも名前が違えば登録できる'
);
select is(
  (select is_official from app.idols where name = 'すのーまん'), false,
  '投稿者が追加したアイドルは既定で公式ではない'
);
select throws_ok(
  $$ insert into app.idols (name, kana) values ('テスト', 'テスト') $$,
  '23514', null, '読み仮名はひらがなと長音だけ'
);
select throws_ok(
  $$ insert into app.venues (name, kana, prefecture, venue_type) values ('テスト会場', 'てすと', '東京都', 'hall') $$,
  '23514', null, '会場の種別は決めた値だけ'
);

-- sekirepo_api は会場を読むだけ、アイドルは読みと追加だけ
select ok(
  has_table_privilege('sekirepo_api', 'app.venues', 'select')
    and not has_table_privilege('sekirepo_api', 'app.venues', 'insert, update, delete'),
  'sekirepo_api は会場を読むことだけができる'
);
select ok(
  has_table_privilege('sekirepo_api', 'app.idols', 'select')
    and has_table_privilege('sekirepo_api', 'app.idols', 'insert')
    and not has_table_privilege('sekirepo_api', 'app.idols', 'update, delete'),
  'sekirepo_api はアイドルを読むことと追加することだけができる'
);

update app.venues set name = '東京ドーム' where name = '東京ドーム';
select is(
  (select updated_at from app.venues where name = '東京ドーム'), now(),
  '更新すると updated_at がトリガーで書き換わる'
);

select * from finish();
rollback;
