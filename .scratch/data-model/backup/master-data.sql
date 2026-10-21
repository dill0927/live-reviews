SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict a1jxdU15OLRXcZJvWhFBwpz2a36iJ5UgTortr6qcyGuaq7amdrXNty9BUyVc1gE

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: artists; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."artists" ("id", "name", "kana", "is_official", "created_by", "gender") VALUES
	('4c44209e-1dcf-4556-9d9a-ba32384c41c9', 'timelesz', 'たいむれす', true, NULL, 'male'),
	('4916fc5a-a70c-4fe6-85ae-7b2d7a6489af', 'Snow Man', 'すのーまん', true, NULL, 'male'),
	('f6691469-a9ed-4e4a-8369-ad44ea19b57c', 'King & Prince', 'きんぐあんどぷりんす', true, NULL, 'male'),
	('f669e32f-2563-4796-b0d6-669a7cd5fcee', 'NUMBER_i', 'なんばーあい', true, NULL, 'male'),
	('6baf749d-75ae-4ee9-8e5d-d993df5eddb4', 'SixTONES', 'すとーんず', true, NULL, 'male'),
	('acc4699d-c9d5-4d3b-902d-07aa861cfe79', 'なにわ男子', 'なにわだんし', true, NULL, 'male'),
	('37e005af-5d0d-4106-a145-6f1eaf711f86', 'Hey! Say! JUMP', 'へいせいじゃんぷ', true, NULL, 'male'),
	('44aa2211-9e6e-474b-9995-3bfed072ea82', 'Kis-My-Ft2', 'きすまいふっとつー', true, NULL, 'male'),
	('991c500e-f852-47c0-92af-170fc9232256', 'KinKi Kids', 'きんききっず', true, NULL, 'male'),
	('32e2a497-e510-4681-a3ed-a5941cc1f958', 'WEST', 'うえすと', true, NULL, 'male'),
	('acec352f-3db4-4851-a98a-d4f3adb3e2b3', 'Aぇ! group', 'ええぐるーぷ', true, NULL, 'male'),
	('0b1fa0a6-fd71-4a4e-b38d-3c504382a1f5', 'Travis Japan', 'とらびすじゃぱん', true, NULL, 'male'),
	('4704ede9-4b18-473e-99cf-e2cebc14d909', 'ACEes', 'えーしーいーず', true, NULL, 'male'),
	('e0856ea8-f033-47bf-af62-ff5bff99bf10', 'JO1', 'じぇいおーわん', true, NULL, 'male'),
	('f49dfca4-8863-47bf-b35b-d0f923614596', 'INI', 'あいえぬあい', true, NULL, 'male'),
	('0ffa88bf-0d01-49e4-8057-a808a93e3143', 'BE:FIRST', 'びーふぁーすと', true, NULL, 'male'),
	('4d4b4a2c-1aa0-4fe8-9ec0-da5ecab5acff', '超特急', 'ちょうとっきゅう', true, NULL, 'male'),
	('400fc73e-b642-48ca-927b-3d1dd1524124', 'Stray Kids', 'すとれいきっず', true, NULL, 'male'),
	('942efc69-4cde-40e3-9c6b-66d79ef49f07', 'TOMORROW X TOGETHER', 'とぅもろーばいつぎゃざー', true, NULL, 'male'),
	('8cfa42a2-7e36-46b3-a055-4e2af6c6b08f', 'ENHYPEN', 'えんはいふん', true, NULL, 'male'),
	('536f4e7d-fc67-4bdf-ba8f-0890780f6916', 'TREAURE', 'とれじゃー', true, NULL, 'male'),
	('357805fb-390e-46d9-807a-18bb074b2cb5', 'NCT', 'えぬしーてぃー', true, NULL, 'male'),
	('a02160fa-f9a6-4e25-8735-b3a88db01c1f', 'SEVENTEEN', 'せぶんてぃーん', true, NULL, 'male'),
	('05ce68a5-a702-42a7-b35f-88d8361d948e', '乃木坂46', 'のぎざかふぉーてぃーしっくす', true, NULL, 'female'),
	('7e71aee8-cf7f-42a6-9ec2-9fd826581b36', '櫻坂46', 'さくらざかふぉーてぃーしっくす', true, NULL, 'female'),
	('b525aca1-f7a3-4136-9024-7d92e137f4df', '日向坂46', 'ひなたざかふぉーてぃーしっくす', true, NULL, 'female'),
	('2822cc51-47a7-4c8e-9d1d-86b761dc6158', 'AKB48', 'えーけーびーふぉーてぃーえいと', true, NULL, 'female'),
	('24842133-f0ff-4122-9fc9-bc486f49f576', 'Perfume', 'ぱふゅーむ', true, NULL, 'female'),
	('a35afe3d-a60a-4874-b00c-f1063e887c1d', 'ももいろクローバーZ', 'ももいろくろーばーぜっと', true, NULL, 'female'),
	('94d5e6a9-0969-4dc9-840f-c086d48e7c2b', 'TWICE', 'とぅわいす', true, NULL, 'female'),
	('870e739c-b88d-414b-8792-9a1f9d80027d', 'LE SSERAFIM', 'るせらふぃむ', true, NULL, 'female'),
	('336c0451-e05c-470b-95f4-65fdced8aa3c', 'ITZY', 'いつじー', true, NULL, 'female'),
	('2b8336a5-e44f-48fd-a017-b921be41a727', 'BLACKPINK', 'ぶらっくぴんく', true, NULL, 'female'),
	('5bbdab42-8af0-4888-84d7-bdd789ef83a8', 'NiziU', 'にじゅー', true, NULL, 'female'),
	('48c52d04-7858-44ea-80a2-891f736150ad', 'Kep1er', 'けぷらー', true, NULL, 'female'),
	('1f29bc24-d567-460a-a0df-9d84c00a2762', 'IVE', 'あいぶ', true, NULL, 'female'),
	('48e16d9c-17dd-4ea6-91a5-4c18be501f62', 'aespa', 'えすぱ', true, NULL, 'female'),
	('18c23ac7-6088-4fd0-a218-f434a2d5ada2', 'BABYMETAL', 'べびーめたる', true, NULL, 'female'),
	('01f8c7a2-7bde-4c07-9af6-6758b7534caa', 'ME:I', 'みーあい', true, NULL, 'female'),
	('8e809781-ddd0-419e-a4ba-c6c8f3a68c32', 'FRUITS ZIPPER', 'ふるーつじっぱー', true, NULL, 'female'),
	('634d3243-79ee-4b81-af35-e53d0cb91120', '新しい学校のリーダーズ', 'あたらしいがっこうのりーだーず', true, NULL, 'female'),
	('6060a0f5-6f64-4b5a-9af2-3968ac4c3ebc', 'ano', 'あの', true, NULL, 'female'),
	('6566686e-581e-43a8-94d7-db3c2d2fcc00', 'SUPER EIGHT', 'すーぱーえいと', true, NULL, 'male'),
	('49b5e4f4-f31e-4bda-8eeb-072ba75a1b31', 'HiHi Jets', 'はいはいじぇっつ', false, NULL, NULL),
	('22b9f50d-e94c-46ad-9cc0-4669155916ed', 'ジュニア', NULL, false, 'b4b90cfd-5625-40ad-abee-1298c68d42af', NULL);


--
-- Data for Name: venues; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."venues" ("id", "name", "image_url", "capacity", "access", "seat", "website", "type", "prefecture") VALUES
	('f989a18c-917d-4708-a206-25050b727972', '日産スタジアム', '/img/nissan_stadium.jpg', '72,327', 'JR「小机駅」から徒歩7分', 'アリーナ、スタンド（１階・２階）', 'https://www.nissan-stadium.jp/floor/sheet.php', 'スタジアム', '神奈川県'),
	('1b8f3e8b-d3cb-442b-b50e-7fdd162d405f', 'バンテリンドーム ナゴヤ', '/img/vantelin_dome_nagoya.jpg', '50,647', '地下鉄名城線「ナゴヤドーム前矢田駅」から徒歩5分', 'アリーナ、スタンド、ドコモビジネス プライムツイン、プライム・ボックス、レストランシート', 'https://dragons.jp/ticket/sales/seatchart.html', 'ドーム', '愛知県'),
	('a8eb9643-7e5e-44bb-b4d0-f41882d42b2b', '味の素スタジアム', '/img/ajinomoto_stadium.jpg', '69,663', '京王線「飛田給駅」から徒歩5分', 'アリーナ、スタンド（上層・下層）', 'https://www.ajinomotostadium.com/seat/', 'スタジアム', '東京都'),
	('bf5d0ff3-5aff-4855-859c-2e5db36b2a3b', '大和ハウスプレミストドーム（旧：札幌ドーム）', '/img/sapporo_dome.jpg', '53,820', '地下鉄東豊線「福住駅」から徒歩10分', 'アリーナ、スタンド、スカイボックスシート、ファミリーシート、スイートシート', 'https://www.sapporo-dome.co.jp/guide/', 'ドーム', '北海道'),
	('d2e99f3f-3261-439d-8736-00c368a20135', 'みずほPayPayドーム福岡', '/img/fukuoka_paypay_dome.jpg', '52,500', '地下鉄空港線「唐人町駅」から徒歩15分', 'アリーナ、スタンド、コカ・コーラシート、やまやめんたいこBOX', 'https://beak.softbankhawks.co.jp/ex/seat/pc/map/', 'ドーム', '福岡県'),
	('221a78de-8674-4963-a56c-732a9cf888fe', '東京ドーム', '/img/tokyo_dome.jpg', '55000', 'JR「水道橋駅」から徒歩2分', 'アリーナ、スタンド', 'https://www.tokyo-dome.co.jp/dome/seat/', 'ドーム', '東京都'),
	('8c501b4e-8eff-4be3-bdd3-450c1bf74fa5', '京セラドーム大阪', '/img/kyocera_dome_osaka.jpg', '55,000', '地下鉄長堀鶴見緑地線「ドーム前千代崎駅」から徒歩すぐ', 'アリーナ、スタンド（上段・下段）', 'https://www.kyoceradome-osaka.jp/seat/', 'ドーム', '大阪府'),
	('8444e0f0-e5c0-4c91-9a07-464f63727fc4', '豊田スタジアム', '/img/toyota_stadium.jpg', '45,000', '名鉄三河線「豊田市駅」から徒歩15分', 'アリーナ、スタンド（１階〜４階）', 'https://www.toyota-stadium.co.jp/stand/', 'スタジアム', '愛知県'),
	('a4ea42f8-9ec7-46c8-9a1e-67a76d3f56d0', 'エディオンピースウイング広島', '/img/edion_peace_wing_hiroshima.jpg', '30,000', '広島電鉄「西広島駅」から徒歩15分', 'アリーナ、スタンド（一層、二層）', 'https://hiroshima-stadiumpark.jp/peacewing/stand/', 'スタジアム', '広島県'),
	('c3163ea1-be87-4900-8fda-6be6a2113846', 'ヤンマースタジアム長居', '/img/yanmar_stadium_nagai.jpg', '50,000', 'JR阪和線「鶴ヶ丘駅」から徒歩5分', 'アリーナ、スタンド', 'https://nagaipark.com/stadium/stand/', 'スタジアム', '大阪府'),
	('44d1ce8a-cd91-427f-bfd3-e804bb541bb4', '国立競技場', '/img/kokuritsu-kyogijyo.jpg', '67,750', 'JR総武線「千駄ヶ谷駅」または「信濃町駅」から徒歩5分﻿', 'アリーナ、スタンド（一層〜三層）', 'https://www.jpnsport.go.jp/kokuritu/tabid/58/default.aspx', 'スタジアム', '東京都'),
	('0d1ccff3-d374-4ed0-b9ae-118c63af63e5', 'LaLa arena TOKYO-BAY（ららアリーナ 東京ベイ）', '/img/no_image.jpg', '11,000', 'JR「新習志野駅」から徒歩1分', 'アリーナ、スタンド（２階〜４階）、VIPルーム', 'https://lalaarenatokyo-bay.com/seats/', 'アリーナ', '東京都'),
	('27df0332-eb8f-49b2-829e-bf4dba077b8d', 'エコパアリーナ', '/img/no_image.jpg', '10,000', 'JR「愛野駅」から徒歩15分', 'アリーナ、スタンド', 'https://www.ecopa.jp/facility/arena/seat/', 'アリーナ', '静岡県'),
	('4aba2d90-19bd-41fa-9624-8f16e7cc924e', '有明アリーナ', '/img/ariake_arena.jpg', '15,000', 'ゆりかもめ「有明テニスの森駅」から徒歩8分', 'アリーナ、スタンド（２階〜４階）', 'https://ariake-arena.tokyo/floor/', 'アリーナ', '東京都'),
	('31bc9afb-e5ec-41b3-8a88-c61edd73e009', '日本武道館', '/img/nippon_budokan.jpg', '10,000', '東京メトロ東西線・半蔵門線・都営新宿線「九段下駅」2番出口から徒歩5分', 'アリーナ、スタンド（１階、２階）', 'https://www.nipponbudokan.or.jp/pdf/about/2007.pdf', 'アリーナ', '東京都'),
	('4c69d609-3c3d-4b5c-9140-1e13852e5507', 'マリンメッセ福岡A館', '/img/marine_messe_fukuoka_a.jpg', '15,000', 'JR「博多駅」からバスで15分', 'アリーナ、スタンド（１階、２階）', 'https://www.marinemesse.or.jp/messe/seat/', 'アリーナ', '福岡県'),
	('596cca45-1b38-4ed8-9f46-60f1966a404f', '北海道立総合体育センター（北海きたえーる）', '/img/hokkai_kitael.jpg', '10,000', '地下鉄東豊線「豊平公園駅」から徒歩1分', 'アリーナ、スタンド（１階、２階）', 'https://www.kitayell.jp/facilities/sports/main-arena/', 'アリーナ', '北海道'),
	('63679ffb-f620-4fa6-b9be-9764a5b899e1', 'セキスイハイムスーパーアリーナ', '/img/no_image.jpg', '7,063', 'JR「利府駅」からバスで15分', 'アリーナ、スタンド', 'https://www.mspf.jp/grande21/index.php?action=sisetu_shoukai_arena', 'アリーナ', '宮城県'),
	('64d1238e-93f0-4fe0-9bed-3a8172ca643c', 'ゼビオアリーナ仙台', '/img/no_image.jpg', '6,000', '仙台市地下鉄南北線「長町駅」から徒歩5分', 'アリーナ、2階スタンド、3階ロイヤルボックス', 'https://www.xebioarena.com/seat/', 'アリーナ', '宮城県'),
	('81da6d31-2c25-4b24-8dee-3a01c6259f79', 'Aichi Sky Expo（愛知県国際展示場）Aホール', '/img/aichi_sky_expo_a_hall.jpg', '6,500〜10,000', '名鉄常滑線「りんくう常滑駅」から徒歩5分', 'アリーナのみ', 'https://www.aichiskyexpo.com/floormap/', 'アリーナ', '愛知県'),
	('96f45f39-693a-463c-9954-51f154265cd1', '真駒内セキスイハイムアイスアリーナ', '/img/no_image.jpg', '10,770', '地下鉄南北線「真駒内駅」からバスで10分', 'アリーナ、スタンド', 'http://www.makomanai.com/icearena/archives/318', 'アリーナ', '北海道'),
	('a5183dfd-aee4-470e-b90f-e02722fee962', '横浜アリーナ', '/img/yokohama_arena.jpg', '17,000', 'JR「新横浜駅」から徒歩5分', 'センター、アリーナ、スイート・ボックス、スタンド、立見スペース', 'https://www.yokohama-arena.co.jp/seatguide/', 'アリーナ', '神奈川県'),
	('b9be8462-471d-4478-aff2-8f7b48cfef0d', '日本ガイシホール', '/img/nippon_gaishi_hall.jpg', '10,000', 'JR「笠寺駅」から徒歩3分', 'アリーナ、スタンド（２階〜４階）', 'https://hall.bex.jp/seating-chart/', 'アリーナ', '愛知県'),
	('e330ad86-051a-43b9-83c5-2c46a70c3d47', '大阪城ホール', '/img/osaka_jo_hall.jpg', '16,000', 'JR「大阪城公園駅」から徒歩5分', 'アリーナ、スタンド、BOX席', 'https://www.osaka-johall.com/seat/', 'アリーナ', '大阪府'),
	('e61d780b-79fe-4dd8-be5d-bd398d4a6221', 'ぴあアリーナMM', '/img/pia_arena_mm.jpg', '12,141', 'みなとみらい線「みなとみらい駅」から徒歩7分', 'アリーナ、スタンド（２階〜４階）', 'https://pia-arena-mm.jp/seatmap/index.html', 'アリーナ', '神奈川県'),
	('fe9734c2-3137-44a0-9521-2fefc76d33b1', 'さいたまスーパーアリーナ', '/img/saitama_super_arena.jpg', '37,000', 'JR「さいたま新都心駅」から徒歩3分', 'アリーナ、スタンド（200レベル、400レベル、500レベル）', 'https://www.saitama-arena.co.jp/seats_info/', 'アリーナ', '埼玉県'),
	('feed37d6-2ebe-4aee-876a-52d059577d1c', '神戸ワールド記念ホール', '/img/kobe_world_hall.jpg', '8,000', 'ポートライナー「市民広場駅」から徒歩1分', 'アリーナ、スタンド', 'https://www.kobe-spokyo.jp/world-kobe/guide/zaseki', 'アリーナ', '兵庫県'),
	('c8c59ecd-35b2-4173-b227-356fe0ca7ce0', 'Kアリーナ横浜', '/img/k_arena_yokohama.jpg', '20,033', 'みなとみらい線「新高島駅」から徒歩2分', 'アリーナ（LEVEL１） 、ロアースタンド（LEVEL３）、ミドルスタンド（LEVEL５）、アッパースタンド（LEVEL７）', 'https://k-arena.com/seat/', 'アリーナ', '神奈川県');


--
-- PostgreSQL database dump complete
--

-- \unrestrict a1jxdU15OLRXcZJvWhFBwpz2a36iJ5UgTortr6qcyGuaq7amdrXNty9BUyVc1gE

RESET ALL;
