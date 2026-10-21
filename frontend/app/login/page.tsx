// app/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaXTwitter } from "react-icons/fa6";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (error.message.includes("Password should be at least 6 characters")) {
        toast.error("パスワードは6文字以上で入力してください");
      } else {
        alert("エラー: " + error.message);
      }
    } else {
      alert("ログイン成功！");
      router.push("/");
    }
  };

  const handleOAuthLogin = async (provider: "google" | "twitter") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/oauth/callback`, // コールバックページへ
      },
    });
    if (error) alert("SNSログイン失敗: " + error.message);
  };

  return (
    <>
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-[#ef866b]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">ログイン</h2>
        </div>
        <p className="text-sm mb-1">メールアドレス</p>
        <input
          type="email"
          placeholder="sekirepo@example.com"
          className="w-full p-2 border mb-4 border-[#fae4de] bg-[#fdf8f5]"
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-sm mb-1">パスワード（英数字6文字以上）</p>
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 mb-4 bg-orange-50 border border-orange-100"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={handleSignIn}
          className="w-full bg-[#f9a691] text-white  py-3 px-4 rounded-md font-semibold hover:bg-[#ef866b]  cursor-pointer"
        >
          メールでログイン
        </button>

        <div className="text-center my-4 text-gray-500">または</div>

        <button
          onClick={() => handleOAuthLogin("twitter")}
          className="w-full bg-black text-white py-3 px-4 rounded-md flex items-center gap-3 mb-3 font-semibold hover:bg-gray-500"
        >
          <FaXTwitter className="w-6 h-6" />
          <span className="mx-auto">X（Twitter）でログイン</span>
        </button>
        <button
          onClick={() => handleOAuthLogin("google")}
          className="w-full bg-white border border-gray-300 text-gray-800 py-3 px-4 rounded-md flex items-center gap-3 font-semibold hover:bg-gray-100"
        >
          <FcGoogle className="w-6 h-6 rounded-full" />
          <span className="mx-auto">Googleでログイン</span>
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          まだアカウントをお持ちではないですか？{" "}
          <span
            onClick={() => router.push("/signup")}
            className="text-blue-500 underline cursor-pointer"
          >
            無料登録
          </span>
        </p>
      </div>
    </>
  );
}
