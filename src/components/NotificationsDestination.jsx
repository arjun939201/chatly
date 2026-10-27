import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const nextOffsetRef = useRef(0);

  const filteredItems = items.filter(item => filter === "all" || (filter === "unread" ? !item.read_at : item.type === filter));

  async function markRead(id) {
    if (!session?.user?.id) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", id).eq("recipient_id", session.user.id).is("read_at", null);
    if (updateError) { setError(updateError.message || "Could not mark notification as read."); return; }
    setItems(current => current.map(item => item.id === id && !item.read_at ? { ...item, read_at: readAt } : item));
    setUnreadCount(current => Math.max(0, current - 1));
  }

  async function markAllRead() {
    if (!session?.user?.id || unreadCount === 0) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt }).eq("recipient_id", session.user.id).is("read_at", null);
    if (updateError) { setError(updateError.message || "Could not mark notifications as read."); return; }
    setItems(current => current.map(item => item.read_at ? item : { ...item, read_at: readAt }));
    setUnreadCount(0);
  }

  // Keep unread activity unread until the user explicitly marks it read.
  const loadNotifications = useCallback(async (silent = false, append = false) => {
    if (!session?.user?.id) {
      setItems([]);
      setUnreadCount(0);
      setHasMore(false);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    if (append) setLoadingMore(true);
    setError("");
    try {
      // Keep initial activity requests bounded; older activity is fetched only on demand.
      const pageSize = 50;
      const offset = append ? nextOffsetRef.current : 0;
      const [pageResult, unreadResult] = await Promise.all([
        supabase.from("notifications")
          .select("id,recipient_id,actor_id,type,post_id,comment_id,created_at,read_at")
          .eq("recipient_id", session.user.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + pageSize - 1),
        append ? Promise.resolve({ count: null, error: null }) : supabase.from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", session.user.id)
          .is("read_at", null)
      ]);
      if (pageResult.error) throw pageResult.error;
      if (unreadResult.error) throw unreadResult.error;
      const notifications = pageResult.data || [];
      if (!append) {
        nextOffsetRef.current = notifications.length;
        setHasMore(notifications.length === pageSize);
        if (unreadResult.count !== null) setUnreadCount(unreadResult.count || 0);
      } else {
        nextOffsetRef.current = offset + notifications.length;
        setHasMore(notifications.length === pageSize);
      }
      if (!notifications.length) {
        if (!append) setItems([]);
        setHasMore(false);
        return;
      }

      const actorIds = [...new Set(notifications.map(row => row.actor_id).filter(Boolean))];
      const postIds = [...new Set(notifications.map(row => row.post_id).filter(Boolean))];
      const commentIds = [...new Set(notifications.map(row => row.comment_id).filter(Boolean))];
      const [profilesResult, postsResult, commentsResult] = await Promise.all([
        actorIds.length ? supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", actorIds) : Promise.resolve({ data: [], error: null }),
        postIds.length ? supabase.from("posts").select("id,body,created_at").in("id", postIds) : Promise.resolve({ data: [], error: null }),
        commentIds.length ? supabase.from("post_comments").select("id,body").in("id", commentIds) : Promise.resolve({ data: [], error: null })
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (postsResult.error) throw postsResult.error;
      if (commentsResult.error) throw commentsResult.error;
      const profileMap = Object.fromEntries((profilesResult.data || []).map(person => [person.id, person]));
      const postMap = Object.fromEntries((postsResult.data || []).map(post => [post.id, post]));
      const commentMap = Object.fromEntries((commentsResult.data || []).map(comment => [comment.id, comment]));
      const mapped = notifications.map(row => ({
        ...row,
        user_id: row.actor_id,
        actor: profileMap[row.actor_id] || {},
        actors: [profileMap[row.actor_id]].filter(Boolean),
        post: postMap[row.post_id] || {},
        body: commentMap[row.comment_id]?.body || ""
      }));
      setItems(current => {
        if (!append) return mapped;
        const merged = new Map(current.map(item => [item.id, item]));
        mapped.forEach(item => merged.set(item.id, item));
        return [...merged.values()].sort((a, b) =>
          new Date(b.created_at || b.post?.created_at || 0) - new Date(a.created_at || a.post?.created_at || 0)
        );
      });
    } catch (err) {
      console.error("Notifications load failed:", err);
      // Keep already-rendered activity visible if a background refresh or page fetch fails.
      if (!silent) setError(err.message || "Could not load notifications.");
    } finally {
      if (!silent) setLoading(false);
      setLoadingMore(false);
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
          <div className="notification-controls-row"><div className="notification-filter-row" role="group" aria-label="Filter notifications">{["all","like","comment","follow"].map(value => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(20); }}>{value === "all" ? "All" : value === "like" ? "Likes" : value === "comment" ? "Comments" : "Follows"}</button>)}</div><div className="notification-heading-actions">{unreadCount > 0 && <button type="button" className="notification-mark-all-read" onClick={markAllRead}>Mark all read <span>{unreadCount}</span></button>}<button type="button" className="notification-refresh-button" onClick={loadNotifications} disabled={loading} aria-label="Refresh notifications" title="Refresh notifications"><RefreshCw size={16} className={loading ? "is-spinning" : ""}/></button></div></div>
          {loading ? (
            <div className="notification-skeleton-list" role="status" aria-label="Loading notifications" aria-busy="true">
              <span className="sr-only">Loading notifications…</span>
              {Array.from({ length: 6 }, (_, index) => (
                <div className="notification-skeleton-row" key={index} aria-hidden="true">
                  <span className="notification-skeleton-avatar"/>
                  <div className="notification-skeleton-copy">
                    <div className="notification-skeleton-topline">
                      <span className="notification-skeleton-name"/>
                      <span className="notification-skeleton-action"/>
                      <span className="notification-skeleton-time"/>
                    </div>
                    {index % 3 !== 2 && <span className={`notification-skeleton-detail ${index % 2 ? "is-short" : ""}`}/>}
                  </div>
                </div>
              ))}
            </div>
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
              {(filteredItems.length > visibleCount || hasMore) && <button type="button" className="notification-load-more" disabled={loadingMore} onClick={() => {
                if (filteredItems.length > visibleCount) setVisibleCount(count => count + 20);
                else loadNotifications(true, true).then(() => setVisibleCount(count => count + 20));
              }} aria-label={loadingMore ? "Loading more notifications" : "Load more notifications"}>{loadingMore ? "Loading activity…" : "Load more activity"}</button>}
            </div>
          ) : (
            <div className="notification-empty-state" role="status"><span className="notification-empty-icon"><Bell size={21}/></span><h3>You’re all caught up</h3><p>When someone likes or comments on your posts, or follows you, you’ll see it here.</p></div>
          )}
        </section>
      </div>
    </section>
  );
}
