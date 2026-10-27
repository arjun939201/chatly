import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Heart, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function HistoryDestination({ session, onBack }) {
  const [view, setView] = useState("bookmarks");
  const [posts, setPosts] = useState([]);
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const table = view === "bookmarks" ? "saved_posts" : "post_likes";
        const { data: rows, error: rowsError } = await supabase.from(table)
          .select("post_id,created_at").eq("user_id", session.user.id)
          .order("created_at", { ascending: false }).limit(100);
        if (rowsError) {
          if (rowsError.code === "PGRST205") {
            throw new Error(view === "bookmarks"
              ? "Bookmarks are not available yet because saved-post storage is not configured."
              : "Liked-post history is not available yet because like storage is not configured.");
          }
          throw rowsError;
        }
        const ids = (rows || []).map(row => row.post_id).filter(Boolean);
        if (!ids.length) {
          if (!cancelled) { setPosts([]); setAuthors({}); }
          return;
        }
        const { data, error: postError } = await supabase.from("posts")
          .select("id,user_id,body,created_at").in("id", ids);
        if (postError) throw postError;
        const byId = new Map((data || []).map(post => [String(post.id), post]));
        const ordered = ids.map(id => byId.get(String(id))).filter(Boolean);
        const authorIds = [...new Set(ordered.map(post => post.user_id).filter(Boolean))];
        const { data: profiles, error: profilesError } = authorIds.length
          ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", authorIds)
          : { data: [], error: null };
        if (profilesError) throw profilesError;
        const authorMap = Object.fromEntries((profiles || []).map(person => [person.id, person]));
        if (!cancelled) { setPosts(ordered); setAuthors(authorMap); }
      } catch (e) {
        if (!cancelled) setError(e.message || "History could not be loaded.");
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [session.user.id, view, retry]);

  return <main className="history-page">
    <header className="history-page-header"><button type="button" aria-label="Back to feed" onClick={onBack}><ArrowLeft size={19}/></button><div><h1>History</h1><p>Your saved and liked posts</p></div></header>
    <div className="history-tabs" role="tablist" aria-label="History type">
      <button id="history-bookmarks-tab" type="button" role="tab" aria-controls="history-post-panel" aria-selected={view === "bookmarks"} tabIndex={view === "bookmarks" ? 0 : -1} className={view === "bookmarks" ? "active" : ""} onClick={() => setView("bookmarks")}><Bookmark size={17}/>Bookmarks</button>
      <button id="history-liked-tab" type="button" role="tab" aria-controls="history-post-panel" aria-selected={view === "liked"} tabIndex={view === "liked" ? 0 : -1} className={view === "liked" ? "active" : ""} onClick={() => setView("liked")}><Heart size={17}/>Liked posts</button>
    </div>
    <section id="history-post-panel" role="tabpanel" aria-labelledby={view === "bookmarks" ? "history-bookmarks-tab" : "history-liked-tab"} aria-busy={loading}>
    {loading ? <div className="history-state" role="status">Loading history…</div> : error ? <div className="history-state" role="status"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}><RefreshCw size={16}/> Try again</button></div> : posts.length ? <div className="history-post-list">{posts.map(post => { const author = authors[post.user_id] || {}; return <article className="history-post" key={post.id}><div className="history-post-author"><span className="history-author-avatar">{author.avatar_url ? <img src={author.avatar_url} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.dataset.fallback = (author.display_name || author.username || "C").slice(0, 1).toUpperCase(); }} /> : (author.display_name || author.username || "C").slice(0, 1).toUpperCase()}</span><span className="history-author-copy"><strong>{author.display_name || author.username || "Chatly member"}</strong><small>{author.username ? `@${author.username}` : "Community post"}</small></span></div><p>{post.body}</p><small className="history-post-date">{post.created_at ? new Date(post.created_at).toLocaleDateString([], { dateStyle: "medium" }) : "Recently"}</small></article>; })}</div> : <div className="history-state"><span>{view === "bookmarks" ? <Bookmark size={24}/> : <Heart size={24}/>}</span><h2>{view === "bookmarks" ? "No bookmarks yet" : "No liked posts yet"}</h2><p>{view === "bookmarks" ? "Posts you save will appear here." : "Posts you like will appear here."}</p></div>}
    </section>
  </main>;
}