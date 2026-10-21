import type { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/lib/SupabaseProvider";
import { Toaster } from "react-hot-toast";

const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-zen-maru",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "席レポ | ライブ会場の座席口コミ共有サイト",
    template: "%s | 席レポ",
  },
  description:
    "ライブ・コンサート会場の座席からの見え方や体験を共有するファン向けレビューサイト。アイドル、アーティストのライブで推しがよく見える席情報を投稿・検索できます。",
  keywords: [
    "ライブ会場",
    "座席",
    "口コミ",
    "レビュー",
    "アイドル",
    "コンサート",
    "ドーム",
    "アリーナ",
    "席",
    "見え方",
    "推し",
  ],
  authors: [{ name: "席レポ運営チーム" }],
  creator: "席レポ",
  publisher: "席レポ",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://your-domain.com",
    siteName: "席レポ",
    title: "席レポ | ライブ会場の座席口コミ共有サイト",
    description:
      "ライブ・コンサート会場の座席からの見え方や体験を共有するファン向けレビューサイト",
  },
  twitter: {
    card: "summary_large_image",
    title: "席レポ | ライブ会場の座席口コミ共有サイト",
    description:
      "ライブ・コンサート会場の座席からの見え方や体験を共有するファン向けレビューサイト",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "席レポ",
    description:
      "ライブ・コンサート会場の座席からの見え方や体験を共有するファン向けレビューサイト",
    url: "https://sekirepo.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://sekirepo.com/?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: "席レポ",
      url: "https://sekirepo.com",
    },
  };

  return (
    <html lang="ja">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${zenMaruGothic.variable} antialiased`}>
        <Header />
        <SupabaseProvider>{children}</SupabaseProvider>
        <Footer />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: "font-zen",
              background: "primary-lighter",
              color: "foreground",
              fontSize: "14px",
              padding: "12px 16px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
