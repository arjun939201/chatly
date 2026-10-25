import { useCallback, useEffect, useState } from "react";
import { Bell, Heart, MessageCircle, RefreshCw, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationsDestination({ session }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(20);

  const loadNotifications = useCallback(async () => {
    if (!session?.user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      // Notifications are derived from existing app activity tables (no separate
      // notifications table required): likes and comments on the signed-in user's posts.
      const { data: posts, error: postsError } = await supabase
        .from("posts").select("*").eq("user_id", session.user.id);
      if (postsError) throw postsError;
      const postRows = posts || [];
      const postIds = postRows.map(post => post.id);
      const [likesResult, commentsResult, followsResult] = await Promise.all([
        postIds.length ? supabase.from("post_likes").select("post_id,user_id,created_at").in("post_id", postIds).neq("user_id", session.user.id) : Promise.resolve({ data: [], error: null }),
        postIds.length ? supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", postIds).neq("user_id", session.user.id) : Promise.resolve({ data: [], error: null }),
        supabase.from("user_follows").select("follower_id,created_at").eq("following_id", session.user.id).neq("follower_id", session.user.id)
      ]);
      if (likesResult.error) throw likesResult.error;
      if (commentsResult.error) throw commentsResult.error;
      if (followsResult.error) throw followsResult.error;

      const activity = [
        ...(likesResult.data || []).map(row => ({ type: "like", post_id: row.post_id, user_id: row.user_id, created_at: row.created_at })),
        ...(commentsResult.data || []).map(row => ({ ...row, type: "comment" })),
        ...(followsResult.data || []).map(row => ({ type: "follow", user_id: row.follower_id, created_at: row.created_at }))
      ];
      if (!activity.length) { setItems([]); return; }

      // Collapse likes for the same post into one activity row, retaining actor identities.
      const grouped = new Map();
      activity.forEach(item => {
        if (item.type !== "like") { grouped.set(item.id || `${item.type}-${item.user_id}-${item.created_at}`, item); return; }
        const key = `like-${item.post_id}`;
        const group = grouped.get(key) || { ...item, id: key, actors: [], created_at: item.created_at };
        group.actors.push(item.user_id);
        if (new Date(item.created_at || 0) > new Date(group.created_at || 0)) group.created_at = item.created_at;
        grouped.set(key, group);
      });
      const displayActivity = [...grouped.values()];
      const actorIds = [...new Set(displayActivity.flatMap(item => item.actors || [item.user_id]))];
      const [{ data: profiles, error: profileError }] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", actorIds)
      ]);
      if (profileError) throw profileError;
      const profileMap = Object.fromEntries((profiles || []).map(person => [person.id, person]));
      const postMap = Object.fromEntries(postRows.map(post => [post.id, post]));
      setItems(displayActivity.map((item, index) => ({
        ...item,
        id: item.id || `${item.type}-${item.post_id}-${item.user_id}-${index}`,
        actor: profileMap[item.user_id] || {},
        actors: (item.actors || [item.user_id]).map(id => profileMap[id]).filter(Boolean),
        post: postMap[item.post_id] || {}
      })).sort((a, b) => new Date(b.created_at || b.post.created_at) - new Date(a.created_at || a.post.created_at)));
    } catch (err) {
      console.error("Notifications load failed:", err);
      setError(err.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Refresh activity when likes, comments, or follows change in Supabase.
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const channel = supabase.channel(`notifications-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, loadNotifications)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, loadNotifications)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_follows" }, loadNotifications)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, loadNotifications]);

  return (
    <section className="destination-page notification-destination-page" aria-label="Notification activity">
      <div className="notification-content">
        <section className="notification-feed" aria-label="Recent activity">
          <div className="notification-feed-heading"><h2>Activity</h2><button type="button" className="notification-refresh-button" onClick={loadNotifications} disabled={loading} aria-label="Refresh activity" title="Refresh activity"><RefreshCw size={16} className={loading ? "is-spinning" : ""}/></button></div>
          <div className="notification-filter-row" role="group" aria-label="Filter notifications">{["all","like","comment","follow"].map(value => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(20); }}>{value === "all" ? "All" : value === "like" ? "Likes" : value === "comment" ? "Comments" : "Follows"}</button>)}</div>
          {loading ? (
            <div className="notification-empty-state" role="status"><span className="notification-empty-icon"><Bell size={21}/></span><h3>Loading activity</h3><p>Checking for likes, comments, and new followers…</p></div>
          ) : error ? (
            <div className="notification-empty-state" role="alert"><h3>Couldn’t load notifications</h3><p>{error}</p><button type="button" onClick={loadNotifications}><RefreshCw size={15}/> Try again</button></div>
          ) : items.length ? (
            <div className="notification-activity-list">
              {items.filter(item => filter === "all" || item.type === filter).slice(0, visibleCount).map(item => {
                const actorName = item.actor.display_name || item.actor.username || "Someone";
                const others = item.type === "like" ? Math.max(0, (item.actors?.length || 1) - 1) : 0;
                return <article className={`notification-activity-item notification-item-${item.type}`} key={item.id} aria-label={`${actorName} ${item.type === "like" ? "liked your post" : item.type === "comment" ? "commented on your post" : "followed you"}`}>
                  <span className={`notification-activity-icon ${item.type}`} aria-hidden="true">{item.type === "like" ? <Heart size={18} fill="currentColor"/> : item.type === "comment" ? <MessageCircle size={18}/> : <UserPlus size={18}/>}</span>
                  <div className="notification-activity-copy">
                    <p><strong>{actorName}</strong>{others > 0 && <>, <strong>{others} {others === 1 ? "other" : "others"}</strong></>} {item.type === "like" ? "liked your post" : item.type === "comment" ? "commented on your post" : "started following you"}{item.type === "comment" && item.body ? `: “${item.body.length > 180 ? `${item.body.slice(0, 177)}…` : item.body}”` : ""}</p>
                    <span>{relativeTime(item.created_at || item.post.created_at)}</span>
                    {item.type !== "follow" && (item.post.image_url || item.post.media_url || item.post.image) && <img className="notification-post-thumbnail" src={item.post.image_url || item.post.media_url || item.post.image} alt="" loading="lazy"/>}
                    {item.type !== "follow" && item.post.body && <small className="notification-post-preview">{item.post.body}</small>}
                  </div>
                </article>;
              })}
            </div>
          ) : (
            <div className="notification-empty-state" role="status"><span className="notification-empty-icon"><Bell size={21}/></span><h3>You’re all caught up</h3><p>When someone likes or comments on your posts, or follows you, you’ll see it here.</p></div>
          )}
        </section>
      </div>
    </section>
  );
}
