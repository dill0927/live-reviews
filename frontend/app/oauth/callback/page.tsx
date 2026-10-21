"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user;

        if (!user) {
          console.log("ユーザーセッションがありません");
          return;
        }

        // users テーブルにすでにあるか確認
        const { data: existingUser, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (checkError) {
          console.error("usersテーブル確認エラー:", checkError.message);
          return;
        }

        if (!existingUser) {
          const seed = crypto.randomUUID();
          const colors = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];
          const bg = colors[Math.floor(Math.random() * colors.length)];
          const shouldFlip = Math.random() > 0.5;
          const avatarUrl = `https://api.dicebear.com/7.x/thumbs/png?seed=${seed}&size=240&radius=10&backgroundColor=${bg}&flip=${shouldFlip}`;

          const { error } = await supabase.from("users").insert([
            {
              id: user.id,
              username:
              user.user_metadata.full_name || user.email?.split("@")[0],
              avatar_url: avatarUrl,
            },
          ]);
          if (error) {
            console.error("SNS登録時のusersテーブル保存エラー:", error.message);
          } else {
            console.log("新しいSNSユーザーをusersテーブルに保存しました");
          }
        } else {
          console.log("既存ユーザーなのでusersテーブル登録はスキップ");
        }

        router.push("/");
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return <p className="text-center mt-10">ログイン処理中です...</p>;
}
