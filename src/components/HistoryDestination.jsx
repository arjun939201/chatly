import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Heart, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function HistoryDestination({ session, onBack }) {
  const [view, setView] = useState("bookmarks");
  const [posts, setPosts] = useState([]);
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
        if (rowsError) throw rowsError;
        const ids = (rows || []).map(row => row.post_id).filter(Boolean);
        if (!ids.length) { if (!cancelled) setPosts([]); return; }
        const { data, error: postError } = await supabase.from("posts")
          .select("id,user_id,body,created_at").in("id", ids);
        if (postError) throw postError;
        const byId = new Map((data || []).map(post => [String(post.id), post]));
        const ordered = ids.map(id => byId.get(String(id))).filter(Boolean);
        if (!cancelled) setPosts(ordered);
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
      <button type="button" role="tab" aria-selected={view === "bookmarks"} className={view === "bookmarks" ? "active" : ""} onClick={() => setView("bookmarks")}><Bookmark size={17}/>Bookmarks</button>
      <button type="button" role="tab" aria-selected={view === "liked"} className={view === "liked" ? "active" : ""} onClick={() => setView("liked")}><Heart size={17}/>Liked posts</button>
    </div>
    {loading ? <div className="history-state" role="status">Loading history…</div> : error ? <div className="history-state"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}><RefreshCw size={16}/> Try again</button></div> : posts.length ? <div className="history-post-list">{posts.map(post => <article className="history-post" key={post.id}><p>{post.body}</p><small>{post.created_at ? new Date(post.created_at).toLocaleDateString([], { dateStyle: "medium" }) : "Recently"}</small></article>)}</div> : <div className="history-state"><span>{view === "bookmarks" ? <Bookmark size={24}/> : <Heart size={24}/>}</span><h2>{view === "bookmarks" ? "No bookmarks yet" : "No liked posts yet"}</h2><p>{view === "bookmarks" ? "Posts you save will appear here." : "Posts you like will appear here."}</p></div>}
  </main>;
}