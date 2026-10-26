import React, { useCallback, useEffect, useState } from "react";
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


function dateLabel(value) {
  if (!value) return "Earlier";
  const date = new Date(value);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((start - target) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

export default function NotificationsDestination({ session, onOpenProfile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(20);

  const filteredItems = items.filter(item => filter === "all" || (filter === "unread" ? !item.read_at : item.type === filter));
  const unreadCount = items.filter(item => !item.read_at).length;

  async function markRead(id) {
    if (!session?.user?.id) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", id).eq("recipient_id", session.user.id).is("read_at", null);
    if (updateError) { setError(updateError.message || "Could not mark notification as read."); return; }
    setItems(current => current.map(item => item.id === id && !item.read_at ? { ...item, read_at: readAt } : item));
  }

  async function markAllRead() {
    if (!session?.user?.id || unreadCount === 0) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt }).eq("recipient_id", session.user.id).is("read_at", null);
    if (updateError) { setError(updateError.message || "Could not mark notifications as read."); return; }
    setItems(current => current.map(item => item.read_at ? item : { ...item, read_at: readAt }));
  }

  // Opening Notifications marks all currently unread activity as read.
  useEffect(() => {
    if (!loading && unreadCount > 0) markAllRead();
  }, [loading, unreadCount, session?.user?.id]);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!session?.user?.id) { setItems([]); setLoading(false); return; }
    if (!silent) setLoading(true); setError("");
    try {
      const pageSize = 100;
      let rows = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data: page, error: notificationError } = await supabase
          .from("notifications")
          .select("id,recipient_id,actor_id,type,post_id,comment_id,created_at,read_at")
          .eq("recipient_id", session.user.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (notificationError) throw notificationError;
        rows = rows.concat(page || []);
        if (!page || page.length < pageSize) break;
      }
      const notifications = rows || [];
      if (!notifications.length) { setItems([]); return; }

      const actorIds = [...new Set(notifications.map(row => row.actor_id))];
      const postIds = [...new Set(notifications.map(row => row.post_id).filter(Boolean))];
      const commentIds = [...new Set(notifications.map(row => row.comment_id).filter(Boolean))];
      const [profilesResult, postsResult, commentsResult] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", actorIds),
        postIds.length ? supabase.from("posts").select("id,body,created_at").in("id", postIds) : Promise.resolve({ data: [], error: null }),
        commentIds.length ? supabase.from("post_comments").select("id,body").in("id", commentIds) : Promise.resolve({ data: [], error: null })
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (postsResult.error) throw postsResult.error;
      if (commentsResult.error) throw commentsResult.error;
      const profileMap = Object.fromEntries((profilesResult.data || []).map(person => [person.id, person]));
      const postMap = Object.fromEntries((postsResult.data || []).map(post => [post.id, post]));
      const commentMap = Object.fromEntries((commentsResult.data || []).map(comment => [comment.id, comment]));
      setItems(notifications.map(row => ({
        ...row,
        user_id: row.actor_id,
        actor: profileMap[row.actor_id] || {},
        actors: [profileMap[row.actor_id]].filter(Boolean),
        post: postMap[row.post_id] || {},
        body: commentMap[row.comment_id]?.body || ""
      })));
    } catch (err) {
      console.error("Notifications load failed:", err);
      setError(err.message || "Could not load notifications.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Subscribe to recipient notification rows; database triggers create activity records.
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const channel = supabase.channel(`notifications-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "recipient_id=eq." + session.user.id }, () => loadNotifications(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, loadNotifications]);

  return (
    <section className="destination-page notification-destination-page" aria-label="Notification activity">
      <div className="notification-content">
        <section className="notification-feed" aria-label="Recent activity">
          <div className="notification-feed-heading"><h2>Activity</h2><div className="notification-heading-actions">{unreadCount > 0 && <button type="button" className="notification-mark-all-read" onClick={markAllRead}>Mark all read <span>{unreadCount}</span></button>}<button type="button" className="notification-refresh-button" onClick={loadNotifications} disabled={loading} aria-label="Refresh activity" title="Refresh activity"><RefreshCw size={16} className={loading ? "is-spinning" : ""}/></button></div></div>
          <div className="notification-filter-row" role="group" aria-label="Filter notifications">{["all","unread","like","comment","follow"].map(value => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(20); }}>{value === "all" ? "All" : value === "unread" ? `Unread${unreadCount ? ` · ${unreadCount}` : ""}` : value === "like" ? "Likes" : value === "comment" ? "Comments" : "Follows"}</button>)}</div>
          {loading ? (
            <div className="notification-empty-state" role="status"><span className="notification-empty-icon"><Bell size={21}/></span><h3>Loading activity</h3><p>Checking for likes, comments, and new followers…</p></div>
          ) : error ? (
            <div className="notification-empty-state" role="alert"><h3>Couldn’t load notifications</h3><p>{error}</p><button type="button" onClick={loadNotifications}><RefreshCw size={15}/> Try again</button></div>
          ) : items.length ? (
            <div className="notification-activity-list">
              {!filteredItems.length && <div className="notification-empty-state" role="status"><h3>No matching activity</h3><p>Try another notification filter.</p></div>}
              {filteredItems.slice(0, visibleCount).map((item, index) => {
                const actorName = item.actor.display_name || item.actor.username || "Someone";
                const others = item.type === "like" ? Math.max(0, (item.actors?.length || 1) - 1) : 0;
                const previous = filteredItems[index - 1];
                const showDate = !previous || dateLabel(previous.created_at || previous.post?.created_at) !== dateLabel(item.created_at || item.post?.created_at);
                return <React.Fragment key={item.id}>{showDate && <h3 className="notification-date-heading">{dateLabel(item.created_at || item.post?.created_at)}</h3>}<article className={`notification-activity-item notification-item-${item.type}${item.read_at ? "" : " is-unread"}`} key={item.id} aria-label={`${actorName} ${item.type === "like" ? "liked your post" : item.type === "comment" ? "commented on your post" : "followed you"}`}>
                  <span className={`notification-activity-icon ${item.type}`} aria-hidden="true">{item.type === "like" ? <Heart size={18} fill="currentColor"/> : item.type === "comment" ? <MessageCircle size={18}/> : <UserPlus size={18}/>}</span>
                  <div className="notification-activity-copy">
                    <button type="button" className="notification-actor-avatar" onClick={() => onOpenProfile?.(item.actor)} disabled={!item.actor?.id} aria-label={`Open ${actorName}'s profile`} title={`Open ${actorName}'s profile`} style={{ width: 36, height: 36, flex: "0 0 36px", borderRadius: "50%", overflow: "hidden", border: 0, padding: 0, background: "var(--surface, #eee)", color: "var(--text, #333)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: item.actor?.id ? "pointer" : "default", fontWeight: 600 }}>
                      {item.actor.avatar_url ? <img src={item.actor.avatar_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.dataset.avatarFallback = actorName.slice(0, 1).toUpperCase(); }} onLoad={e => { e.currentTarget.style.display = ""; delete e.currentTarget.parentElement.dataset.avatarFallback; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : actorName.slice(0, 1).toUpperCase()}
                    </button>
                    <p><button type="button" className="notification-actor-link" onClick={() => onOpenProfile?.(item.actor)} disabled={!item.actor?.id}>{actorName}</button>{others > 0 && <>, <strong>{others} {others === 1 ? "other" : "others"}</strong></>} {item.type === "like" ? "liked your post" : item.type === "comment" ? "commented on your post" : "started following you"}{item.type === "comment" && item.body ? `: “${item.body.length > 180 ? `${item.body.slice(0, 177)}…` : item.body}”` : ""}</p>
                    <span>{relativeTime(item.created_at || item.post.created_at)}</span>
                    
                    {item.type !== "follow" && item.post.body && <small className="notification-post-preview">{item.post.body}</small>}{!item.read_at && <button type="button" className="notification-mark-read" onClick={() => markRead(item.id)}>Mark read</button>}
                  </div>
                </article></React.Fragment>;
              })}
              {filteredItems.length > visibleCount && <button type="button" className="notification-load-more" onClick={() => setVisibleCount(count => count + 20)} aria-label={`Load ${Math.min(20, filteredItems.length - visibleCount)} more notifications`}>Load more activity</button>}
            </div>
          ) : (
            <div className="notification-empty-state" role="status"><span className="notification-empty-icon"><Bell size={21}/></span><h3>You’re all caught up</h3><p>When someone likes or comments on your posts, or follows you, you’ll see it here.</p></div>
          )}
        </section>
      </div>
    </section>
  );
}
