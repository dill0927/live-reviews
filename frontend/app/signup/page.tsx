"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaXTwitter } from "react-icons/fa6";

export default function SignUpPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [redirectUrl, setRedirectUrl] = useState("");

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    const seed = crypto.randomUUID();
    const colors = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];
    const bg = colors[Math.floor(Math.random() * colors.length)];
    const shouldFlip = Math.random() > 0.5;

    const avatarUrl = `https://api.dicebear.com/7.x/thumbs/png?seed=${seed}&size=240&radius=10&backgroundColor=${bg}&flip=${shouldFlip}`;
  
    if (error) {
      if (error.message.includes("Password should be at least 6 characters")) {
        alert("パスワードは6文字以上で入力してください。");
      } else {
        alert("登録エラー: " + error.message);
      }
      return;
    }
  
    if (data.user) {
      const { error: insertError } = await supabase.from("users").insert({
        id: data.user.id,
        username: email.split("@")[0],
        avatar_url: avatarUrl,
        confirmed: false, //メール未確認として登録
      });
  
      if (insertError) {
        console.error("usersテーブルへの事前登録に失敗:", insertError.message);
      } else {
        console.log("usersテーブルに事前登録しました（未確認）");
      }
  
      setEmailSent(true);
    }
  };
  
  //再送信ボタン
  const handleResendEmail = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
  
    if (error) {
      alert("再送信に失敗しました: " + error.message);
    } else {
      alert("確認メールを再送信しました！");
    }
  };

  useEffect(() => {
    setRedirectUrl(`${window.location.origin}/oauth/callback`);
  }, []);
  

  const handleOAuthLogin = async (provider: "google" | "twitter") => {
    if (!redirectUrl) return;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) alert("SNSログイン失敗: " + error.message);
  };

  return (
    <>
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-[#ef866b]">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">無料登録</h2>
      </div>

      {emailSent ? (
        //メール送信後の確認メッセージ
        <div className="mt-6 text-center">
          <p className="text-gray-700 font-semibold">
            確認メールを<br />
            <span className="font-mono">{email}</span><br />
            に送信しました 📩
          </p>
          <p className="text-sm text-gray-500 mt-2">
            メール内のリンクをクリックして登録を完了してください。
          </p>
          <button
            onClick={handleResendEmail}
            className="mt-4 inline-block text-sm text-blue-600 underline hover:text-blue-800"
          >
            メールを再送信する
          </button>
        </div>
      ) : (
        //メールアドレス登録フォーム
        <>
          <p className="text-sm mb-1">メールアドレス</p>
          <input
            type="email"
            placeholder="sekirepo@example.com"
            className="w-full p-2 border mb-4 border-orange-100 bg-orange-50"
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-sm mb-1">パスワード（英数字6文字以上）</p>
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 mb-4 bg-orange-50 border border-orange-100"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleSignUp} className="w-full bg-[#f9a691] text-white  py-3 px-4 rounded-md font-semibold hover:bg-[#ef866b]  cursor-pointer">
            無料登録する
          </button>
        </>
      )}

      <div className="text-center my-4 text-gray-500">または</div>

      <button
        onClick={() => handleOAuthLogin("twitter")}
        className="w-full bg-black text-white py-3 px-4 rounded-md flex items-center gap-3 mb-3 font-semibold hover:bg-gray-500"
      >
        <FaXTwitter className="w-6 h-6" />
        <span className="mx-auto">X（Twitter）で登録</span>
      </button>
      <button
        onClick={() => handleOAuthLogin("google")}
        className="w-full bg-white border border-gray-300 text-gray-800 py-3 px-4 rounded-md flex items-center gap-3 font-semibold hover:bg-gray-100"
      >
        <FcGoogle className="w-6 h-6 rounded-full" />
        <span className="mx-auto">Googleで登録</span>
      </button>
      

      <p className="mt-4 text-center text-sm text-gray-500">
        すでにアカウントをお持ちですか？{" "}
        <span
          onClick={() => router.push("/login")}
          className="text-blue-500 underline cursor-pointer"
        >
          ログイン
        </span>
      </p>
    </div>
    </>
  );
}
