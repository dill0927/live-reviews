"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { FaBars, FaTimes } from "react-icons/fa";

type Venue = {
  id: string;
  name: string;
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{
    username: string;
    avatar_url: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        setUser(null);
        return;
      }

      if (data.user) {
        setUser(data.user);
      }

      const { data: profile } = await supabase
        .from("users")
        .select("avatar_url, username")
        .eq("id", data.user.id)
        .single();

      if (profile) {
        setUserData(profile);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }

    const fetchVenues = async () => {
      const { data } = await supabase.rpc("search_venues", {
        query: searchQuery,
      });
      if (data) setSearchResults(data);
    };

    fetchVenues();
  }, [searchQuery]);

  const handleSelectVenue = (venueId: string) => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    setMenuOpen(false);
    router.push(`/venue/${venueId}`);
  };

  const searchUIPages = ["/", "/login", "/signup"];
  const showSearchUI =
    searchUIPages.includes(pathname) ||
    (pathname.startsWith("/venue/") && !pathname.includes("/review"));

  return (
    <header className="sticky top-0 bg-surface text-black p-3 flex justify-between  shadow z-50">
      {/* 🔹 ロゴ */}
      <Link href="/">
        <Image
          src="/logo/logo5.png"
          alt="logo"
          width={180}
          height={40}
          priority
        />
      </Link>

      {/* 🍔 ハンバーガーメニューアイコン（モバイル） */}
      <button
        className="md:hidden text-2xl"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="メニューを開く"
      >
        {menuOpen ? (
          <FaTimes className="text-primary" />
        ) : (
          <FaBars className="text-primary" />
        )}
      </button>

      {/* 🔹 メニュー（モバイル時はtoggle, PC時は常時表示） */}
      <div
        className={`${
          menuOpen ? "block" : "hidden"
        } absolute top-20 left-0 w-full bg-white px-2 py-2 space-y-4 md:space-y-0 md:space-x-4 md:static md:flex md:items-center md:w-auto md:bg-transparent z-40`}
      >
        {showSearchUI && (
          <div className="relative w-full md:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowResults(true)}
              onBlur={() => {
                setTimeout(() => setShowResults(false), 150);
              }}
              placeholder="🔍 会場を検索"
              className="p-2 rounded border border-primary outline-none text-foreground w-full md:w-64"
            />
            {showResults && searchResults.length > 0 && (
              <ul className="absolute left-0 w-full md:w-64 bg-surface text-foreground rounded mt-1 shadow-lg z-50">
                {searchResults.map((venue) => (
                  <li
                    key={venue.id}
                    className="p-2 hover:bg-gray-200 cursor-pointer"
                    onClick={() => handleSelectVenue(venue.id)}
                  >
                    {venue.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 👤 ログイン状態による表示切替 */}
        {mounted && !user ? (
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="text-primary-light border border-primary-light px-4 py-1 rounded hover:bg-primary-lighter text-center inline-block"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="bg-primary-light text-surface px-4 py-1 rounded hover:bg-primary text-center inline-block"
            >
              無料登録
            </Link>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <p className="text-xs ml-auto text-foreground">
              👋ようこそ、{userData?.username}さん
            </p>
            <Link href="/mypage" onClick={() => setMenuOpen(false)}>
              <Image
                src={userData?.avatar_url || "/logo/default-avatar.png"}
                alt="ユーザーアイコン"
                width={50}
                height={50}
                className="rounded-2xl outline outline-1 outline-primary-light outline-offset-2 cursor-pointer"
              />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
