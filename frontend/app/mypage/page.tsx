"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FaRandom } from "react-icons/fa";

type Review = {
  id: string;
  venue_id: string;
  seat_number: string;
  created_at: string;
  venues?: {
    name: string;
  };
};

export default function MyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("/logo/default-avatar.png");
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from("users").select("username, avatar_url").eq("id", user.id).single();
        if (data) {
          setUsername(data.username || "");
          setAvatarUrl(data.avatar_url || "/logo/default-avatar.png");
        }

        const { data: reviewData } = await supabase
          .from("reviews")
          .select("*, venues(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (reviewData) setReviews(reviewData);
      }
      setLoading(false);
    };
    fetchUserInfo();
  }, []);

  const handleUpdate = async () => {
    if (!userId) return;
    const { error } = await supabase.from("users").update({
      username,
      avatar_url: avatarUrl,
    }).eq("id", userId);

    if (error) alert("更新に失敗しました: " + error.message);
    else alert("プロフィールを更新しました！");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleDelete = async () => {
    if (!userId) return;
    const confirm = window.confirm("本当に退会しますか？すべての投稿が削除されます。");
    if (!confirm) return;

    await supabase.from("users").delete().eq("id", userId);
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleRandomAvatar = () => {
    const seed = crypto.randomUUID();
    const colors = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];
    const bg = colors[Math.floor(Math.random() * colors.length)];
    const shouldFlip = Math.random() > 0.5;
  
    const url = `https://api.dicebear.com/7.x/thumbs/png?seed=${seed}&size=240&radius=10&backgroundColor=${bg}&flip=${shouldFlip}`;
    setAvatarUrl(url);
  };

  const goToReviewDetail = (reviewId: string) => {
    router.push(`/review/${reviewId}`);
  };
  

  if (loading) return <p className="text-center mt-10">読み込み中...</p>;

  return (
    <>
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-gray-700">
      <h2 className="text-2xl font-bold mb-4 text-[#ef866b] text-center">マイページ</h2>

      <div className="flex flex-col items-center mb-6">
        <Image src={avatarUrl} alt="プロフィール画像" width={80} height={80} className="rounded-2xl border-2 border-[#f9a691]" />
        <button onClick={handleRandomAvatar} className="mt-3 text-sm text-[#ef866b] cursor-pointer">
          <FaRandom className="m-auto text-3xl"/>
          ランダムな画像に変更
        </button>
      </div>

      <label className="block mb-4">
        <p className="text-sm">ユーザー名</p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border bg-[#fdf8f5] border-[#fae4de] rounded"
        />
      </label>

      <button
        onClick={handleUpdate}
        className="w-full bg-[#f9a691] hover:bg-[#ef866b] text-white font-semibold py-2 px-4 rounded mb-4"
      >
        プロフィールを更新
      </button>

      <button
        onClick={handleLogout}
        className="w-full bg-gray-300 hover:bg-gray-400 text-white font-semibold py-2 px-4 rounded mb-2"
      >
        ログアウト
      </button>

      <button
        onClick={handleDelete}
        className="w-full bg-red-400 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded"
      >
        退会する
      </button>

      <div className="mt-10">
        <h3 className="text-lg font-bold mb-2">あなたの投稿</h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500">まだ投稿はありません。</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                onClick={() => goToReviewDetail(r.id)}
                className="p-3 bg-[#fdf8f5] border border-[#fae4de] rounded cursor-pointer hover:bg-[#fae4de]"
              >
                <p className="text-sm font-semibold">{r.venues?.name || "不明な会場"}</p>
                <p className="text-xs text-gray-600">座席: {r.seat_number}</p>
                <p className="text-xs text-gray-600">投稿日: {new Date(r.created_at).toLocaleDateString("ja-JP")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </>
  );
}
