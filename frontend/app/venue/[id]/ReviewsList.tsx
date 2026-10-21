"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
// import { useRouter } from "next/navigation";
import { FaStar } from "react-icons/fa";
import IconRatingDisplay from "@/app/components/IconRatingDisplay";
import Image from "next/image";
import LikeButton from "./LikeButton"; // ← 事前に用意してね！

interface Filters {
  artistId: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  seat: string;
  keyword: string;
}

type ReviewType = {
  id: string;
  user_id: string;
  venue_id: string;
  seat_number: string;
  artist_id: string;
  visibility: number;
  v_comment: string;
  sound: number;
  s_comment: string;
  facilities: number;
  f_comment: string;
  access: number;
  a_comment: string;
  created_at: string;
};

type ReviewWithUser = ReviewType & {
  users: {
    username: string;
    avatar_url: string;
  };
  artists: {
    name: string;
  };
};

export default function ReviewsList({ venueId, filters }: { venueId: string; filters: Filters }) {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  // const router = useRouter();

  // 🔹 ログイン中ユーザーの取得
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUserId(data.user.id);
      }
    };
    getUser();
  }, []);

  // 🔹 フィルターに基づいてレビュー取得
  useEffect(() => {
    const fetchReviews = async () => {
      let query = supabase
        .from("reviews")
        .select("*, users(username, avatar_url), artists(name)")
        .eq("venue_id", venueId);

      if (filters.artistId) query = query.eq("artist_id", filters.artistId);
      if (filters.seat) query = query.ilike("seat_number", `%${filters.seat}%`);
      if (filters.keyword) {
        query = query.or([
          `v_comment.ilike.%${filters.keyword}%`,
          `s_comment.ilike.%${filters.keyword}%`,
          `f_comment.ilike.%${filters.keyword}%`,
          `a_comment.ilike.%${filters.keyword}%`,
        ].join(","));
      }
      if (filters.startYear && filters.startMonth) {
        query = query.gte("created_at", `${filters.startYear}-${filters.startMonth}-01`);
      }
      if (filters.endYear && filters.endMonth) {
        query = query.lte("created_at", `${filters.endYear}-${filters.endMonth}-31`);
      }

      const { data, error } = await query;
      if (!error && data) {
        setReviews(data as ReviewWithUser[]);
      }
    };

    fetchReviews();
  }, [venueId, filters]);

  if (reviews.length === 0) {
    return <p className="mt-4 text-gray-500">該当する口コミはありません</p>;
  }

  return (
    <div className="mt-6 text-gray-700 space-y-4">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="p-5 rounded-lg bg-white shadow-md border border-gray-200"
          // onClick={() => router.push(`/review/${review.id}`)}
        >
          {/* 🔹 ヘッダー */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Image
                src={review.users?.avatar_url || "/logo/default-avatar.png"}
                alt="ユーザーアイコン"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full border-2 border-gray-300"
              />
              <div className="text-sm text-gray-800 font-semibold">
                {review.users?.username || "ゲストさん"}
              </div>
              <div className="flex space-x-2 text-xs text-gray-600">
                <span className="bg-[#9fecdb] px-2 py-0.5 rounded">{review.seat_number}</span>
                <span className="bg-[#addcf1] px-2 py-0.5 rounded">{review.artists?.name || "不明なアーティスト"}</span>
              </div>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {new Date(review.created_at).toLocaleDateString("ja-JP")}
            </span>
          </div>

          {/* 🔹 評価項目 */}
          <div className="divide-y divide-gray-200">
            <div className="py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-700">👀 見やすさ</span>
                <IconRatingDisplay rating={review.visibility} icon={<FaStar />} size="text-base" />
              </div>
              <p className="text-sm text-gray-600">{review.v_comment}</p>
            </div>

            <div className="py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-700">🎧 音響</span>
                <IconRatingDisplay rating={review.sound} icon={<FaStar />} size="text-base" />
              </div>
              <p className="text-sm text-gray-600">{review.s_comment}</p>
            </div>

            <div className="py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-700">🏪 周辺施設</span>
                <IconRatingDisplay rating={review.facilities} icon={<FaStar />} size="text-base" />
              </div>
              <p className="text-sm text-gray-600">{review.f_comment}</p>
            </div>

            <div className="pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-700">🚃 アクセス</span>
                <IconRatingDisplay rating={review.access} icon={<FaStar />} size="text-base" />
              </div>
              <p className="text-sm text-gray-600">{review.a_comment}</p>
            </div>
          </div>
          <div className="mt-3">
            {/* 🔹 いいね機能 */}
            <LikeButton reviewId={review.id} userId={userId} />
          </div>
        </div>
      ))}
    </div>
  );
}
