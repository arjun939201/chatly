import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export function useExploreData() {
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [peopleError, setPeopleError] = useState("");
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setPeopleError("");
      setPostsError("");

      const [profilesResult, postsResult] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url,bio").order("display_name").limit(200),
        supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(200)
      ]);
      if (!alive) return;

      if (profilesResult.error) setPeopleError("People could not be loaded. Please try again.");
      setPeople(profilesResult.data || []);

      if (postsResult.error) {
        setPostsError("Posts could not be loaded. Please try again.");
        setPosts([]);
        setLoading(false);
        return;
      }

      const rows = postsResult.data || [];
      const authorIds = [...new Set(rows.map(post => post.user_id).filter(Boolean))];
      const authorsResult = authorIds.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", authorIds)
        : { data: [], error: null };
      if (!alive) return;

      if (authorsResult.error) setPostsError("Post authors could not be loaded. Please try again.");
      const authorsById = Object.fromEntries((authorsResult.data || []).map(person => [person.id, person]));
      setPosts(rows.map(post => ({ ...post, author: authorsById[post.user_id] || {} })));
      setLoading(false);
    }

    load().catch(error => {
      if (!alive) return;
      console.error("Explore data load failed:", error);
      setPeopleError("People could not be loaded. Please try again.");
      setPostsError("Posts could not be loaded. Please try again.");
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  return { people, posts, loading, peopleError, postsError };
}

export function useExploreResults(people, posts, query) {
  const normalizedQuery = query.trim().toLowerCase();
  const peopleResults = useMemo(
    () => people.filter(person => `${person.display_name || ""} ${person.username || ""}`.toLowerCase().includes(normalizedQuery)),
    [people, normalizedQuery]
  );
  const postResults = useMemo(
    () => posts.filter(post => `${post.body || ""} ${post.author?.display_name || ""} ${post.author?.username || ""}`.toLowerCase().includes(normalizedQuery)),
    [posts, normalizedQuery]
  );
  return { peopleResults, postResults };
}
