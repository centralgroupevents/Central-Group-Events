import { useQuery } from "@tanstack/react-query";

export interface InstagramMedia {
  id: string;
  media_type: "IMAGE" | "CAROUSEL_ALBUM";
  media_url: string;
  permalink: string;
  timestamp: string;
}

function isHttpsUrl(value: unknown, instagramOnly = false): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (!instagramOnly || ["instagram.com", "www.instagram.com"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function useInstagramFeed() {
  return useQuery<InstagramMedia[]>({
    queryKey: ["/api/instagram/feed"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/instagram/feed", { credentials: "include", signal });
      if (!response.ok) throw new Error("Instagram photos are temporarily unavailable.");
      const records: unknown = await response.json();
      if (!Array.isArray(records)) throw new Error("Instagram photos are temporarily unavailable.");
      return records.filter((item): item is InstagramMedia =>
        item !== null && typeof item === "object" &&
        typeof item.id === "string" &&
        (item.media_type === "IMAGE" || item.media_type === "CAROUSEL_ALBUM") &&
        isHttpsUrl(item.media_url) && isHttpsUrl(item.permalink, true) &&
        typeof item.timestamp === "string" && Number.isFinite(Date.parse(item.timestamp))
      ).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
        .slice(0, 12);
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
