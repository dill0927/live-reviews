import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://sekirepo.com";

  // 静的ページ
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    },
  ];

  try {
    // 動的ページ（会場）
    const { data: venues } = await supabase
      .from("venues")
      .select("id, updated_at");

    const venuePages =
      venues?.map((venue) => ({
        url: `${baseUrl}/venue/${venue.id}`,
        lastModified: new Date(venue.updated_at || new Date()),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })) || [];

    // 動的ページ（レビュー）
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, updated_at");

    const reviewPages =
      reviews?.map((review) => ({
        url: `${baseUrl}/review/${review.id}`,
        lastModified: new Date(review.updated_at || new Date()),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })) || [];

    return [...staticPages, ...venuePages, ...reviewPages];
  } catch (error) {
    console.warn("Failed to generate dynamic sitemap entries:", error);
    // エラーが発生した場合は静的ページのみ返す
    return staticPages;
  }
}
