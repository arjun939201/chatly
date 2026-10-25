import { useEffect, useState } from "react";

export function useYouTubeSearch(query, category) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const normalizedQuery = query.trim();
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (category !== "songs" || !normalizedQuery) {
      setVideos([]);
      setError("");
      setLoading(false);
      return;
    }
    if (!apiKey) {
      setVideos([]);
      setError("YouTube search needs a VITE_YOUTUBE_API_KEY configured in your deployment.");
      setLoading(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          part: "snippet", type: "video", videoCategoryId: "10",
          maxResults: "20", q: normalizedQuery, key: apiKey
        });
        const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");
        if (alive) setVideos(data.items || []);
      } catch (requestError) {
        if (alive && requestError.name !== "AbortError") {
          setVideos([]);
          setError(requestError.message || "Unable to search YouTube.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category]);

  return { videos, loading, error };
}
