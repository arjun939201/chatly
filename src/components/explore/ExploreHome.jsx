import { useEffect, useState } from "react";
import { Compass, TrendingUp, RefreshCw, Hash } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function ExploreHome({ onSearch }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecentPosts() {
    setLoading(true);
    setError("");
    try {
      const { data, error: postsError } = await supabase.from("posts")
        .select("id,user_id,body,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (postsError) throw postsError;
      const rows = data || [];
      const authorIds = [...new Set(rows.map(post => post.user_id).filter(Boolean))];
      const { data: profiles, error: profilesError } = authorIds.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", authorIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const authorMap = Object.fromEntries((profiles || []).map(person => [person.id, person]));
      setPosts(rows.map(post => ({ ...post, author: authorMap[post.user_id] || {} })));
    } catch (loadError) {
      setError("Recent posts are unavailable right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRecentPosts(); }, []);

  return <section className="explore-home" aria-label="Explore discovery home">
    <div className="explore-home-heading">
      <span className="explore-home-icon"><Compass size={21} /></span>
      <div><h2>Discover on Chatly</h2><p>Find conversations and people beyond your feed.</p></div>
    </div>
    <div className="explore-discovery-actions">
      {["People", "Posts", "Rooms", "Songs"].map((category) => <button key={category} type="button" onClick={() => onSearch(category.toLowerCase())}>{category}</button>)}
    </div>
    <div className="explore-home-section-heading">
      <h3><TrendingUp size={17} /> Recent conversations</h3>
      <button type="button" onClick={loadRecentPosts} disabled={loading} aria-label="Refresh recent posts"><RefreshCw size={15} /></button>
    </div>
    {loading ? <p role="status" className="explore-home-status">Loading recent posts…</p>
      : error ? <div className="explore-home-status" role="alert">{error}<button type="button" onClick={loadRecentPosts}>Retry</button></div>
      : posts.length ? <div className="explore-home-posts">{posts.map(post => <article className="explore-home-post" key={post.id}>
          <div className="explore-home-post-author">{post.author.display_name || post.author.username || "Chatly member"}{post.author.username ? <span> @{post.author.username}</span> : null}</div>
          <p>{post.body}</p>
          <time dateTime={post.created_at || undefined}>{post.created_at ? new Date(post.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Recently"}</time>
        </article>)}</div>
      : <p className="explore-home-status">No public posts yet. Be the first to start a conversation.</p>}
  </section>;
}
