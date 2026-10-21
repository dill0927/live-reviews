import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// OGP画像は Edge Function で動作させる必要がある
export const runtime = "edge";

// ReviewsList.tsxと同じ型定義を使用
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
  } | null;
  artists: {
    name: string;
  } | null;
};

// Next.js 14 App Router での正しいEdge APIハンドラー定義
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const reviewId = (await params).id;

  // Supabaseから口コミデータを取得（結合含む）
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "*, users(username, avatar_url), artists(name)"
    )
    .eq("id", reviewId)
    .single();

  // データがなければ404
  if (!data || error) {
    return new Response("Not found", { status: 404 });
  }

  // ReviewsListと同じ型構造に合わせる
  const review = data as ReviewWithUser;

  // OGP画像を返す
  return new ImageResponse(
    (
        <div
        style={{
          position: "relative",
          width: "1200px",
          height: "630px",
          backgroundColor: "#fff8f5",
          fontSize: 28,
          color: "#333",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "70px",
          lineHeight: 1.5,
        }}
      >
        {/* 背景フレーム画像 */}
        <img
          src="https://sekirepo.com/logo/waku.png"
          alt="frame"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "630px",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
        <h1 style={{ fontSize: 37, marginBottom: 20 }}>
        {review.artists?.name ?? "不明"}のライブに行ってきました🐻
        </h1>
        <p>🎫 座席: {review.seat_number}</p>
        <p>👀 見やすさ: {review.v_comment}</p>
        <p style={{ fontSize: 27, marginTop: 20, color: "#676767" }}>※その他、音響・周辺施設・アクセスについてのコメントがあります</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30 }}>
          <p style={{ fontSize: 22, color: "#ef866b", display: "block" }}>#席レポ</p>
          <img
            src="https://sekirepo.com/logo/logo5.png"
            alt="logo"
            width={120}
            height={40}
            style={{ display: "block" }}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}