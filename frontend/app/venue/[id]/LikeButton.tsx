"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FaHeart } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function LikeButton({ reviewId, userId }: { reviewId: string; userId: string | null }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const router = useRouter();

  // 初期状態取得（自分がいいねしてるか、合計何件か）
  useEffect(() => {
    const fetchLikeStatus = async () => {
        // 🔸 いいね数は常に取得
        const { count } = await supabase
          .from("likes")
          .select("*", { count: "exact", head: true })
          .eq("review_id", reviewId);
      
        setLikeCount(count ?? 0);
      
        // 🔸 いいね済みチェックはログインユーザーのみ
        if (userId) {
          const { data: myLike } = await supabase
            .from("likes")
            .select("*")
            .eq("user_id", userId)
            .eq("review_id", reviewId)
            .single();
      
          setLiked(!!myLike);
        }
      };
  
    fetchLikeStatus();
  }, [reviewId, userId]);

  const handleLikeToggle = async () => {
    if (!userId) return alert("ログインするといいねできます");

    setAnimating(true);

    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", userId)
        .eq("review_id", reviewId);
      setLikeCount((prev) => prev - 1);
    } else {
      await supabase.from("likes").insert({
        user_id: userId,
        review_id: reviewId,
      });
      setLikeCount((prev) => prev + 1);
    }

    setLiked(!liked);
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <div>
    {userId ? (
      // ログインしてる → いいねボタン
      <button
        onClick={handleLikeToggle}
        className={`flex items-center gap-1 text-sm ${
          liked ? "text-red-500" : "text-gray-400"
        } transition duration-300`}
      >
        ありがとう<FaHeart
          className={`text-lg ${liked ? "scale-110" : "scale-100"} ${
            animating ? "animate-ping" : ""
          }`}
        />
        {likeCount}
      </button>
    ) : (
      // ログインしてない → グレー表示だけ（押せない）
      <div className="flex items-center gap-1 text-sm text-gray-400">
        ありがとう<FaHeart className="text-lg" />{likeCount}
        <span className="ml-2"> （<span className="text-blue-500 text-sm underline cursor-pointer" onClick={() => router.push(`/login`)}>ログイン</span>して感謝を伝える）</span>
      </div>
    )}
  </div>
  );
}
