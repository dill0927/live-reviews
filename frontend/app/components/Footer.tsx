"use client";

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-surface text-muted py-10 mt-16 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {/* ロゴとキャッチコピー */}
        <div>
          <div className="flex items-center mb-2">
            <Image src="/logo/logo5.png" alt="ロゴ" width={140} height={40} />
          </div>
          <p className="text-sm">ライブの席レポ共有サービス</p>
        </div>

        {/* Aboutセクション */}
        <div>
          <h3 className="font-bold mb-2 text-sm">About</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/terms">利用規約</Link>
            </li>
            <li>
              <Link href="/privacy-policy">プライバシーポリシー</Link>
            </li>
          </ul>
        </div>

        {/* Linksセクション */}
        <div>
          <h3 className="font-bold mb-2 text-sm">Links</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/#venue-list">会場一覧</Link>
            </li>
            <li>
              <Link href="/mypage">マイページ</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
