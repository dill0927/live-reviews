"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  FaEye,
  FaHeadphones,
  FaStore,
  FaTrain,
  FaStar,
} from "react-icons/fa";

export default function ReviewEditPage() {
  const { reviewId } = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState({
    seat_number: "",
    artist_id: "",
    custom_artist: "",
    v_comment: "",
    visibility: 0,
    s_comment: "",
    sound: 0,
    f_comment: "",
    facilities: 0,
    a_comment: "",
    access: 0,
  });
  const [loading, setLoading] = useState(true);
  const [artistList, setArtistList] = useState<{ id: string; name: string; kana?: string }[]>([]);

  const fields = [
    { key: "visibility", label: "見やすさ", commentKey: "v_comment", icon: <FaEye />, placeholder: "ステージの見やすさや距離感など" },
    { key: "sound", label: "音響", commentKey: "s_comment", icon: <FaHeadphones />, placeholder: "音の聴こえ方や反響など" },
    { key: "facilities", label: "周辺施設", commentKey: "f_comment", icon: <FaStore />, placeholder: "トイレや売店、ロッカーの使いやすさなど" },
    { key: "access", label: "アクセス", commentKey: "a_comment", icon: <FaTrain />, placeholder: "駅からの距離、案内の分かりやすさなど" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: review }, { data: artists }] = await Promise.all([
        supabase.from("reviews").select("*").eq("id", reviewId).single(),
        supabase.from("artists").select("id, name, kana"),
      ]);

      if (review) {
        setFormData({
          seat_number: review.seat_number,
          artist_id: review.artist_id,
          custom_artist: "",
          v_comment: review.v_comment,
          visibility: review.visibility,
          s_comment: review.s_comment,
          sound: review.sound,
          f_comment: review.f_comment,
          facilities: review.facilities,
          a_comment: review.a_comment,
          access: review.access,
        });
      }
      if (artists) {
        const sorted = [...artists].sort((a, b) => (a.kana || "").localeCompare(b.kana || ""));
        setArtistList(sorted);
      }
      setLoading(false);
    };
    fetchData();
  }, [reviewId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name.includes("comment") || name === "custom_artist" ? value : value });
  };

  const handleRatingChange = (key: string, value: number) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalArtistId = formData.artist_id;
    if (!finalArtistId && formData.custom_artist.trim()) {
      const { data: inserted, error: insertError } = await supabase
        .from("artists")
        .insert({
          name: formData.custom_artist.trim(),
          is_official: false,
          created_by: null,
        })
        .select()
        .single();

      if (insertError) {
        alert("アーティストの追加に失敗しました: " + insertError.message);
        return;
      }
      finalArtistId = inserted.id;
    }

    const { error } = await supabase.from("reviews").update({
      ...formData,
      artist_id: finalArtistId,
    }).eq("id", reviewId);

    if (error) alert("更新に失敗しました: " + error.message);
    else {
      alert("口コミを更新しました！");
      router.push(`/review/${reviewId}`);
    }
  };

  const handleCancel = () => {
    router.push(`/review/${reviewId}`);
  };

  const StarInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex space-x-1 text-orange-300">
      {[1, 2, 3, 4, 5].map((num) => (
        <FaStar
          key={num}
          className={`cursor-pointer w-6 h-6 ${num <= value ? "fill-[#ef866b]" : "fill-gray-300"}`}
          onClick={() => onChange(num)}
        />
      ))}
    </div>
  );

  if (loading) return <p className="text-center mt-10">読み込み中...</p>;

  return (
    <>
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow text-[#ef866b]">
        <h2 className="text-2xl font-bold mb-6 text-center">口コミを編集</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-[#fae4de] p-4 bg-[#fdf8f5] rounded">
            <label className="text-sm font-semibold block mb-1">座席番号</label>
            <input
              name="seat_number"
              value={formData.seat_number}
              onChange={handleChange}
              className="w-full p-2 border border-[#fae4de] bg-white rounded"
            />
          </div>

          <div className="border border-[#fae4de] p-4 bg-[#fdf8f5] rounded">
            <label className="text-sm font-semibold block mb-1">アーティスト名</label>
            <select
              name="artist_id"
              value={formData.artist_id}
              onChange={handleChange}
              className="w-full p-2 border border-[#fae4de] bg-white rounded"
            >
              <option value="">-- 選択してください --</option>
              {artistList.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-sm mt-2">リストにない場合はこちらに入力</p>
            <input
              type="text"
              name="custom_artist"
              value={formData.custom_artist}
              onChange={handleChange}
              className="w-full mt-1 p-2 border border-[#fae4de] bg-white rounded"
              placeholder="アーティスト名を入力"
            />
          </div>

          {fields.map(({ key, label, commentKey, icon, placeholder }) => (
            <div key={key} className="border border-[#fae4de] p-2 bg-[#fdf8f5] rounded">
              <label className="text-sm font-semibold block mb-1 flex items-center gap-2">
                {icon} {label}
              </label>
              <StarInput
                value={formData[key as keyof typeof formData] as number}
                onChange={(val) => handleRatingChange(key, val)}
              />
              <textarea
                name={commentKey}
                value={formData[commentKey as keyof typeof formData] as string}
                onChange={handleChange}
                className="w-full mt-2 p-2 h-30 border border-[#fae4de] bg-white rounded "
                placeholder={placeholder}
              />
            </div>
          ))}

          <div className="flex justify-between gap-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full bg-gray-300 hover:bg-gray-400 text-white font-semibold py-2 px-4 rounded"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="w-full bg-[#f9a691] hover:bg-[#ef866b] text-white font-semibold py-2 px-4 rounded"
            >
              更新する
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
