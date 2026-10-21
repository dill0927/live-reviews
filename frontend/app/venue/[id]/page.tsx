"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import ReviewsList from "./ReviewsList";
import ReviewSearchForm from "./ReviewSearchForm";
import {
  FaStar,
  FaEye,
  FaHeadphones,
  FaStore,
  FaTrain,
} from "react-icons/fa";
import LabeledRating from "../../components/LabeledRating";
import IconRatingDisplay from "@/app/components/IconRatingDisplay";

type Venue = {
  id: string;
  name: string;
  image_url: string;
  capacity: number;
  access: string;
  seat: string;
  website: string;
  type: string;
};

export default function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = use(params);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [artistList, setArtistList] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({
    artistId: "",
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    seat: "",
    keyword: "",
  });

  useEffect(() => {
    const fetchVenue = async () => {
      const { data } = await supabase.from("venues").select("*").eq("id", venueId).single();
      if (data) setVenue(data);
    };

    const fetchArtists = async () => {
      const { data } = await supabase.from("artists").select("id, name, kana").order("kana");
      if (data) setArtistList(data);
    };

    fetchVenue();
    fetchArtists();
  }, [venueId]);

  const [average, setAverage] = useState({
    visibility: 0,
    sound: 0,
    facilities: 0,
    access: 0,
    overall: 0,
  });

  const renderVenueInfo = (venue: Venue) => (
    <>
      <div className="flex items-center space-x-2">
        <span className="text-lg">👥</span>
        <p>
          <span className="font-semibold">収容人数：</span>
          {venue.capacity.toLocaleString()}人
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-lg">🚶</span>
        <p>
          <span className="font-semibold">アクセス：</span>
          {venue.access}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-lg">💺</span>
        <p>
          <span className="font-semibold">座席タイプ：</span>
          {venue.seat}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-lg">🌐</span>
        <a
          href={venue.website}
          className="text-blue-600 underline hover:text-blue-800 transition"
        >
          場内MAP（公式サイト）
        </a>
      </div>
    </>
  );  

  useEffect(() => {
    const fetchAverages = async () => {
      const { data } = await supabase
        .from("reviews")
        .select("visibility, sound, facilities, access")
        .eq("venue_id", venueId);

      if (data && data.length > 0) {
        const total = data.length;
        const sum = data.reduce(
          (acc, r) => {
            acc.visibility += r.visibility;
            acc.sound += r.sound;
            acc.facilities += r.facilities;
            acc.access += r.access;
            return acc;
          },
          { visibility: 0, sound: 0, facilities: 0, access: 0 }
        );

        setAverage({
          visibility: sum.visibility / total,
          sound: sum.sound / total,
          facilities: sum.facilities / total,
          access: sum.access / total,
          overall: (sum.visibility + sum.sound + sum.facilities + sum.access) / 4 / total,
        });
      }
    };  

    fetchAverages();
  }, [venueId]);

  if (!venue) return <p>会場情報を取得中...</p>;

  return (
<div className="w-full mx-auto">
  {/* トップ画像 */}
  <div
    style={{ backgroundImage: `url(${venue.image_url})` }}
    className="bg-cover bg-center h-60 sm:h-80 w-full relative text-white"
  >

    {/* 会場名 */}
    <h1 className="absolute top-6 left-4 text-2xl sm:text-3xl font-bold z-10">
      📍{venue.name}
    </h1>

    {/* PC用：右下固定カード（非表示 on モバイル） */}
    <div className="hidden sm:block absolute bottom-4 right-4 bg-white/70 backdrop-blur-md rounded-xl shadow-lg p-4 text-sm text-gray-900 space-y-3 z-10">
      {renderVenueInfo(venue)}
    </div>
  </div>

  {/* モバイル用：画像の下に表示（非表示 on PC） */}
  <div className="sm:hidden px-4 mt-4">
    <div className="bg-white/90 rounded-xl shadow-md p-4 space-y-3 text-sm text-gray-900">
      {renderVenueInfo(venue)}
    </div>
  </div>

  {/* 中央ボタン */}
  <div className="flex justify-center pt-5 pb-10 px-4">
    <Link
      href={`/venue/${venueId}/review`}
      className="text-white py-2 px-6 rounded bg-[#f9a691] hover:bg-[#ef866b] text-sm sm:text-base"
    >
      口コミを投稿する
    </Link>
  </div>

  {/* 評価セクション */}
  <div className="px-4 sm:px-10 pb-10">
    <div className="p-4 sm:p-6 bg-white rounded-2xl border-2 border-[#fae4de] mb-10">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mr-4 mb-2 sm:mb-0">
          総合評価
        </h2>
        <IconRatingDisplay
          rating={average.overall}
          icon={<FaStar />}
          size="text-2xl sm:text-3xl"
        />
      </div>

      <div className="text-gray-700">
        <h2 className="text-base sm:text-lg mb-4">カテゴリ別評価</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledRating
            label="見やすさ"
            icon={<FaEye />}
            rating={average.visibility}
            fullColor="text-green-500"
            halfColor="text-green-300"
          />
          <LabeledRating
            label="音響"
            icon={<FaHeadphones />}
            rating={average.sound}
            fullColor="text-blue-500"
            halfColor="text-blue-300"
          />
          <LabeledRating
            label="周辺施設"
            icon={<FaStore />}
            rating={average.facilities}
            fullColor="text-pink-500"
            halfColor="text-pink-300"
          />
          <LabeledRating
            label="アクセス"
            icon={<FaTrain />}
            rating={average.access}
            fullColor="text-orange-500"
            halfColor="text-orange-300"
          />
        </div>
      </div>
    </div>

    {/* フィルター・レビュー一覧 */}
    <ReviewSearchForm artistList={artistList} onSearch={setFilters} />
    <ReviewsList venueId={venueId} filters={filters} />
  </div>
</div>

  );
}
