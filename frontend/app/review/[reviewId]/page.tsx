"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FaEye, FaHeadphones, FaStore, FaTrain } from "react-icons/fa";
import IconRatingDisplay from "@/app/components/IconRatingDisplay";

type ReviewDetail = {
  id: string;
  user_id: string;
  venue_id: string;
  seat_number: string;
  visibility: number;
  v_comment: string;
  sound: number;
  s_comment: string;
  facilities: number;
  f_comment: string;
  access: number;
  a_comment: string;
  created_at: string;
  venues?: { name: string };
  artists?: { name: string };
  users?: { username: string; avatar_url: string };
};

export default function ReviewDetailPage() {
  const { reviewId } = useParams();
  const router = useRouter();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReview = async () => {
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id || null);

      const { data, error } = await supabase
        .from("reviews")
        .select("*, venues(name), artists(name), users(username, avatar_url)")
        .eq("id", reviewId)
        .single();

      if (!error && data) {
        setReview(data);
      }
      setLoading(false);
    };
    fetchReview();
  }, [reviewId]);

  const handleDelete = async () => {
    if (!reviewId) return;
    const confirm = window.confirm("本当にこの口コミを削除しますか？");
    if (!confirm) return;

    await supabase.from("reviews").delete().eq("id", reviewId);
    alert("口コミを削除しました");
    router.push(`/venue/${review?.venue_id}`);
  };

  if (loading) return <p className="text-center mt-10">読み込み中...</p>;
  if (!review) return <p className="text-center mt-10">口コミが見つかりませんでした。</p>;

  return (
    <>
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow text-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-[#ef866b] text-center">口コミ詳細</h2>

        <div className="my-8 text-center border border-black p-2 rounded">
          口コミをXでもシェアしよう！
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`https://sekirepo.com/review/${review.id}`)}&text=${encodeURIComponent("ライブの席レポ投稿しました！")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white bg-black px-4 py-2 rounded inline-block mt-2 ml-3"
          >
            Xでシェア
          </a>
        </div>

        <div className="text-sm text-center text-gray-600 mb-4">
          会場: <span className="font-semibold text-indigo-800 underline cursor-pointer" onClick={() => router.push(`/venue/${review.venue_id}`)}>{review.venues?.name}</span> / アーティスト: <span>{review.artists?.name || "不明"}</span>
        </div>

        <div className="mb-6 border border-[#fae4de] p-3 rounded bg-[#fdf8f5]">
          <p className="text-sm font-semibold">座席番号</p>
          <p className="text-gray-800">{review.seat_number}</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="border border-gray-100 p-4 rounded-md shadow-sm bg-gray-50">
            <p className="flex items-center gap-2 font-semibold mb-1"><FaEye /> 見やすさ</p>
            <IconRatingDisplay rating={review.visibility} icon={<FaEye />} fullColor="text-green-500" halfColor="text-green-300" />
            <p className="text-sm mt-2 text-gray-600 whitespace-pre-line">{review.v_comment}</p>
          </div>

          <div className="border border-gray-100 p-4 rounded-md shadow-sm bg-gray-50">
            <p className="flex items-center gap-2 font-semibold mb-1"><FaHeadphones /> 音響</p>
            <IconRatingDisplay rating={review.sound} icon={<FaHeadphones />} fullColor="text-blue-500" halfColor="text-blue-300" />
            <p className="text-sm mt-2 text-gray-600 whitespace-pre-line">{review.s_comment}</p>
          </div>

          <div className="border border-gray-100 p-4 rounded-md shadow-sm bg-gray-50">
            <p className="flex items-center gap-2 font-semibold mb-1"><FaStore /> 周辺施設</p>
            <IconRatingDisplay rating={review.facilities} icon={<FaStore />} fullColor="text-pink-500" halfColor="text-pink-300" />
            <p className="text-sm mt-2 text-gray-600 whitespace-pre-line">{review.f_comment}</p>
          </div>

          <div className="border border-gray-100 p-4 rounded-md shadow-sm bg-gray-50">
            <p className="flex items-center gap-2 font-semibold mb-1"><FaTrain /> アクセス</p>
            <IconRatingDisplay rating={review.access} icon={<FaTrain />} fullColor="text-orange-500" halfColor="text-orange-300" />
            <p className="text-sm mt-2 text-gray-600 whitespace-pre-line">{review.a_comment}</p>
          </div>
        </div>

        {userId === review.user_id && (
          <div className="mt-8 flex justify-end space-x-2">
            <button
              onClick={() => router.push(`/review/${review.id}/edit`)}
              className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-1 rounded"
            >
              編集
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-400 hover:bg-red-500 text-white px-4 py-1 rounded"
            >
              削除
            </button>
          </div>
        )}

      </div>
    </>
  );
}
