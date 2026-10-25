import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Plus, X, MoreHorizontal, Trash2, Bookmark, Eye, Share2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Feed({ session, profile, onFindFriends, onOpenProfile, onPostsChanged }) {
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [compose, setCompose] = useState(false); const [body, setBody] = useState("");
  const [editingPost, setEditingPost] = useState(null); const [editDraft, setEditDraft] = useState(""); const [editBusy, setEditBusy] = useState(false);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");

const [openComments, setOpenComments] = useState(null);
const [comments, setComments] = useState({});
const [commentsLoading, setCommentsLoading] = useState(true);
const [commentDraft, setCommentDraft] = useState("");
const [commentBusy, setCommentBusy] = useState(false);
const [commentError, setCommentError] = useState("");
const [editingComment, setEditingComment] = useState(null); const [commentEditDraft, setCommentEditDraft] = useState(""); const [commentEditBusy, setCommentEditBusy] = useState(false);
const commentSubmitLock = useRef(false);
  const [postMenu, setPostMenu] = useState(null);
  useEffect(() => { if (postMenu === null) return; function outside(event) { if (!event.target.closest(".post-options-wrap")) setPostMenu(null); } function escape(event) { if (event.key === "Escape") setPostMenu(null); } document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [postMenu]);
  useEffect(() => {
    if (postMenu === null) return;
    document.querySelector(".post-options-menu button:not(:disabled)")?.focus();
  }, [postMenu]);
  useEffect(() => { if (!compose) return; function closeOnEscape(event) { if (event.key === "Escape" && !busy) setCompose(false); } document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [compose, busy]);
  useEffect(() => {
    if (openComments === null) return;
    function closeCommentsOnEscape(event) {
      if (event.key === "Escape") {
        setOpenComments(null);
        setCommentError("");
      }
    }
    document.addEventListener("keydown", closeCommentsOnEscape);
    return () => document.removeEventListener("keydown", closeCommentsOnEscape);
  }, [openComments]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState({});
  const [followBusy, setFollowBusy] = useState({});
  const [savedPosts, setSavedPosts] = useState(new Set());
  const [saveBusy, setSaveBusy] = useState({});
  const saveRequests = useRef(new Set());
  const followRequests = useRef(new Set());
  const [savedView, setSavedView] = useState(false); const [feedFilter, setFeedFilter] = useState("latest"); const [visibleLimit, setVisibleLimit] = useState(20); const [hiddenPostIds, setHiddenPostIds] = useState(new Set()); const [lastHiddenPost, setLastHiddenPost] = useState(null);
  const [viewCounts, setViewCounts] = useState({}); const [expandedMediaUrl, setExpandedMediaUrl] = useState("");
  const requestId = useRef(0);
  const viewedPosts = useRef(new Set());
  async function loadFeed() {
    const request = ++requestId.current;
    setFeedLoading(true);
    setCommentsLoading(true);
    setFeedError("");
    setNotice("");
    try {
    let data; let error;
    if (savedView) {
      const { data: savedRows, error: savedError } = await supabase.from("saved_posts").select("post_id,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(100);
      if (savedError) {
        if (request === requestId.current) {
          setFeedError(savedError.code === "PGRST205"
            ? "Saved posts are unavailable because the saved_posts table is not set up yet."
            : `Could not load saved posts: ${savedError.message}`);
        }
        return;
      }
      const savedIds = (savedRows || []).map(row => row.post_id);
      if (savedIds.length) {
        const result = await supabase.from("posts").select("id,user_id,body,created_at").in("id", savedIds);
        data = result.data;
        error = result.error;
        // Supabase's .in() result order is not guaranteed; retain the saved
        // timestamp order returned by the saved_posts query (newest first).
        if (!error) {
          const savedOrder = new Map(savedIds.map((id, index) => [String(id), index]));
          data = [...(data || [])].sort((a, b) =>
            (savedOrder.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
            (savedOrder.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER)
          );
        }
      } else { data = []; error = null; }
    } else {
      const result = await supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(100); data = result.data; error = result.error;
    }
    if (error) { if (request === requestId.current) setFeedError(`Could not load feed: ${error.message}`); return; }
    // Deduplicate immediately so follow-up profile, reaction, saved, view,
    // and comment queries work against the smallest accurate post set.
    const postRows = [...new Map((data || []).map(post => [post.id, post])).values()];
    const ids = [...new Set(postRows.map(p => p.user_id))];
    const { data: profiles, error: profilesError } = ids.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids) : { data: [], error: null };
    if (profilesError) throw profilesError;
    const map = Object.fromEntries((profiles || []).map(p => [p.id,p]));
    const postIds = postRows.map(post => post.id);
    const [likesResult, followsResult, savedResult, viewsResult] = await Promise.all([
      postIds.length ? supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
      supabase.from("user_follows").select("following_id").eq("follower_id", session.user.id),
      postIds.length ? supabase.from("saved_posts").select("post_id").eq("user_id", session.user.id).in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
      postIds.length ? supabase.rpc("get_post_view_counts", { post_ids: postIds }) : Promise.resolve({ data: [], error: null })
    ]);
    if (likesResult.error) throw likesResult.error;
    if (followsResult.error) throw followsResult.error;
    if (viewsResult.error && viewsResult.error.code !== "PGRST202" && viewsResult.error.code !== "42883") throw viewsResult.error;
    // Saved-post support is optional for the regular feed. A missing table must
    // never prevent posts, likes, follows, or comments from loading.
    const savedTableUnavailable = savedResult.error?.code === "PGRST205";
    if (savedResult.error && !savedTableUnavailable) throw savedResult.error;
    const likes = likesResult.data || [];
    const followedRows = followsResult.data || [];
    const followedIds = new Set((followedRows || []).map(row => row.following_id));
    const savedIds = new Set(savedTableUnavailable ? [] : (savedResult.data || []).map(row => row.post_id));
    if (request !== requestId.current) return;
    const likesByPost = new Map();
    const likedPostIds = new Set();
    for (const like of likes) {
      likesByPost.set(like.post_id, (likesByPost.get(like.post_id) || 0) + 1);
      if (like.user_id === session.user.id) likedPostIds.add(like.post_id);
    }
    setPosts(postRows.map(p => ({
      ...p,
      author: map[p.user_id] || {},
      likes: likesByPost.get(p.id) || 0,
      liked: likedPostIds.has(p.id),
      following: followedIds.has(p.user_id), saved: savedIds.has(p.id)
    })));
    setSavedPosts(savedIds);
    if (!viewsResult.error) setViewCounts(Object.fromEntries((viewsResult.data || []).map(row => [row.post_id, Number(row.view_count) || 0])));
    if (savedTableUnavailable && request === requestId.current) {
      setNotice("Saved posts are unavailable until the saved_posts table is configured. Your feed is still working.");
    }
    if (postRows.length) { const { data: commentRows, error: commentsError } = await supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", postRows.map(p => p.id)).order("created_at"); if (commentsError) throw commentsError; const commentIds = [...new Set((commentRows || []).map(c => c.user_id))]; const { data: commentProfiles, error: commentProfilesError } = commentIds.length ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", commentIds) : { data: [], error: null }; if (commentProfilesError) throw commentProfilesError; const authors = Object.fromEntries((commentProfiles || []).map(p => [p.id,p])); if (request !== requestId.current) return; setComments(Object.fromEntries(postRows.map(p => [p.id,(commentRows || []).filter(c => c.post_id === p.id).map(c => ({...c,author:authors[c.user_id] || {}}))]))); } else { if (request !== requestId.current) return; setComments({}); }
    } catch (error) {
      console.error("Feed load failed:", error);
      if (request === requestId.current) {
        setFeedError(error?.code === "PGRST205"
          ? "Saved posts are unavailable because the saved_posts table is not set up yet."
          : "The feed could not be refreshed. Please try again.");
      }
    }
    finally { if (request === requestId.current) { setFeedLoading(false); setCommentsLoading(false); } }
  }
  useEffect(() => { loadFeed(); return () => { requestId.current += 1; }; }, [savedView]);
  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("post");
    if (!sharedId || feedLoading) return;
    const target = [...document.querySelectorAll(".post-card[data-post-id]")].find(node => String(node.dataset.postId) === sharedId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("shared-post-highlight");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, [posts, feedLoading]);
  useEffect(() => {
    if (!posts.length || !session?.user?.id || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(async entry => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
        const postId = entry.target.dataset.postId;
        const post = posts.find(item => String(item.id) === String(postId));
        if (!post || post.user_id === session.user.id || viewedPosts.current.has(String(postId))) return;
        viewedPosts.current.add(String(postId));
        const { data, error } = await supabase.rpc("record_post_view", { p_post_id: post.id });
        if (error) {
          viewedPosts.current.delete(String(postId));
          console.error("Could not record post view:", error);
        } else if (data === true) {
          setViewCounts(current => ({ ...current, [post.id]: (Number(current[post.id]) || 0) + 1 }));
        }
      });
    }, { threshold: [0.5] });
    document.querySelectorAll(".post-card[data-post-id]").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [posts, session?.user?.id, savedView]);
  async function publish(e) { e.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setNotice(""); try { const { error } = await supabase.from("posts").insert({ user_id:session.user.id, body:body.trim() }); if (error) throw error; setBody(""); setCompose(false); await Promise.all([loadFeed(), onPostsChanged?.()]); } catch (error) { setNotice(error.message || "Your post could not be published. Please try again."); } finally { setBusy(false); } }
  function beginEdit(post) { setEditingPost(post); setEditDraft(post.body || ""); setPostMenu(null); }
  async function saveEdit(e) {
    e.preventDefault();
    const text = editDraft.trim();
    if (!editingPost || !text || editBusy) return;
    setEditBusy(true); setNotice("");
    try {
      const { error } = await supabase.from("posts").update({ body: text }).eq("id", editingPost.id).eq("user_id", session.user.id);
      if (error) throw error;
      setPosts(current => current.map(post => post.id === editingPost.id ? { ...post, body: text } : post));
      setEditingPost(null); setEditDraft("");
    } catch (error) { setNotice(error.message || "Could not update your post. Please try again."); }
    finally { setEditBusy(false); }
  }
  async function deletePost(post) {
    if (post.user_id !== session.user.id || deleteBusy) return;
    if (!window.confirm("Delete this post permanently? Your post and its comments will be removed. This action cannot be undone.")) return;
    setDeleteBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", session.user.id);
      if (error) throw error;
      setPosts(current => current.filter(item => item.id !== post.id));
      setComments(current => {
        const next = { ...current };
        delete next[post.id];
        return next;
      });
      if (openComments === post.id) setOpenComments(null);
      setNotice("Post deleted successfully.");
      try { await onPostsChanged?.(); } catch (refreshError) { console.error("Post-change notification failed:", refreshError); }
    } catch (error) {
      setNotice(error.message || "Could not delete this post. Please try again.");
    } finally {
      setDeleteBusy(false);
      setPostMenu(null);
    }
  }
  const likeRequests = useRef(new Set());
  function hidePost(post) {
    setHiddenPostIds(current => new Set([...current, String(post.id)]));
    setLastHiddenPost(post);
    setNotice("Post hidden from your feed.");
    setPostMenu(null);
  }
  function undoHidePost() {
    if (!lastHiddenPost) return;
    setHiddenPostIds(current => { const next = new Set(current); next.delete(String(lastHiddenPost.id)); return next; });
    setLastHiddenPost(null);
    setNotice("Post restored.");
  }
  async function sharePost(post) {
    const shareUrl = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Chatly post", text: post.body, url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setNotice("Post link copied.");
      } else {
        setNotice("Sharing is not available in this browser.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Could not share this post. Please try again.");
    }
  }
  async function toggleLike(post) {
    if (likeRequests.current.has(post.id)) return;
    likeRequests.current.add(post.id);
    const wasLiked = !!post.liked;
    const delta = wasLiked ? -1 : 1;
    setLikeBusy(current => ({ ...current, [post.id]: true }));
    setNotice("");
    setPosts(current => current.map(item => item.id === post.id
      ? { ...item, liked: !wasLiked, likes: Math.max(0, (Number(item.likes) || 0) + delta) }
      : item));
    try {
      const result = wasLiked
        ? await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", session.user.id)
        : await supabase.from("post_likes").insert({ post_id: post.id, user_id: session.user.id });
      if (result.error) throw result.error;
    } catch (error) {
      setPosts(current => current.map(item => item.id === post.id
        ? { ...item, liked: wasLiked, likes: Math.max(0, (Number(item.likes) || 0) - delta) }
        : item));
      setNotice(error.message || "Could not update like. Please try again.");
    } finally {
      likeRequests.current.delete(post.id);
      setLikeBusy(current => ({ ...current, [post.id]: false }));
    }
  }
  async function toggleSavePost(post) { if (saveRequests.current.has(post.id)) return; saveRequests.current.add(post.id); const wasSaved = savedPosts.has(post.id); setSaveBusy(v => ({...v,[post.id]:true})); setSavedPosts(v => { const n = new Set(v); wasSaved ? n.delete(post.id) : n.add(post.id); return n; }); setPosts(v => v.map(p => p.id === post.id ? {...p,saved:!wasSaved} : p)); try { const result = wasSaved ? await supabase.from("saved_posts").delete().eq("user_id",session.user.id).eq("post_id",post.id) : await supabase.from("saved_posts").insert({user_id:session.user.id,post_id:post.id}); if (result.error) throw result.error; } catch(error) { setSavedPosts(v => { const n = new Set(v); wasSaved ? n.add(post.id) : n.delete(post.id); return n; }); setPosts(v => v.map(p => p.id === post.id ? {...p,saved:wasSaved} : p)); setNotice(error.message || "Could not update saved post. Please try again."); } finally { saveRequests.current.delete(post.id); setSaveBusy(v => ({...v,[post.id]:false})); } }
  async function toggleFollowAuthor(post) { if (post.user_id === session.user.id || followRequests.current.has(post.user_id)) return; followRequests.current.add(post.user_id); const wasFollowing = !!post.following; setFollowBusy(v => ({...v,[post.user_id]:true})); setNotice(""); try { const result = wasFollowing ? await supabase.from("user_follows").delete().eq("follower_id",session.user.id).eq("following_id",post.user_id) : await supabase.from("user_follows").insert({follower_id:session.user.id,following_id:post.user_id}); if (result.error) throw result.error; setPosts(current => current.map(p => p.user_id === post.user_id ? {...p,following:!wasFollowing} : p)); } catch(error) { setNotice(error.message || "Could not update follow."); } finally { followRequests.current.delete(post.user_id); setFollowBusy(v => ({...v,[post.user_id]:false})); } }
  function startCommentEdit(comment) { setEditingComment(comment.id); setCommentEditDraft(comment.body); }
  async function saveCommentEdit(comment) {
    const text = commentEditDraft.trim();
    if (!text || commentEditBusy) return;
    setCommentEditBusy(true); setCommentError("");
    try {
      const { error } = await supabase.from("post_comments").update({ body: text }).eq("id", comment.id).eq("user_id", session.user.id);
      if (error) throw error;
      setComments(current => ({ ...current, [comment.post_id]: (current[comment.post_id] || []).map(item => item.id === comment.id ? { ...item, body: text } : item) }));
      setEditingComment(null); setCommentEditDraft("");
    } catch (error) { setCommentError(error.message || "Could not update this comment."); }
    finally { setCommentEditBusy(false); }
  }
  async function deleteComment(comment) {
    if (!window.confirm("Delete your comment?")) return;
    setCommentError("");
    try {
      const { error } = await supabase.from("post_comments").delete().eq("id", comment.id).eq("user_id", session.user.id);
      if (error) throw error;
      setComments(current => ({ ...current, [comment.post_id]: (current[comment.post_id] || []).filter(item => item.id !== comment.id) }));
    } catch (error) { setCommentError(error.message || "Could not delete this comment."); }
  }
  async function submitComment(e, postId) { e.preventDefault(); const text = commentDraft.trim(); if (!text || commentSubmitLock.current) return; commentSubmitLock.current = true; setCommentBusy(true); setCommentError(""); setNotice(""); try { const { data, error } = await supabase.from("post_comments").insert({post_id:postId,user_id:session.user.id,body:text}).select("id,post_id,user_id,body,created_at").single(); if (error) throw error; const newComment = { ...data, author: { id: session.user.id, display_name: profile?.display_name || "You", username: profile?.username || "", avatar_url: profile?.avatar_url || "" } }; setComments(current => ({ ...current, [postId]: [...(current[postId] || []), newComment] })); setCommentDraft(""); } catch (error) { setCommentError(error.message || "Could not send your comment. Your draft is still here—please try again."); } finally { commentSubmitLock.current = false; setCommentBusy(false); } }
  const imageUrlForPost = (text) => {
    const match = text.match(/https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s<>"']*)?/i);
    return match?.[0] || "";
  };
  const filteredPosts = posts.filter(post => !hiddenPostIds.has(String(post.id)));
  const orderedPosts = savedView ? filteredPosts : (feedFilter === "following" ? filteredPosts.filter(post => post.following || post.user_id === session.user.id) : feedFilter === "popular" ? [...filteredPosts].sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0)) : filteredPosts);
  const visiblePosts = orderedPosts.slice(0, visibleLimit);
  const avatar = (p) => <span className="mini-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt=""/> : (p?.display_name || "C").slice(0,1).toUpperCase()}</span>;
  return <main className="feed-page"><div className="feed-column">
    <div className="feed-heading-row"><div><h1>{savedView ? "Saved posts" : "Your feed"}</h1>{savedView && <p>Posts you bookmarked for later</p>}</div><button type="button" className="feed-saved-view-toggle" aria-pressed={savedView} onClick={() => setSavedView(value => !value)}><Bookmark size={16} fill={savedView ? "currentColor" : "none"}/>{savedView ? "Back to feed" : "Saved posts"}</button></div>
    {!savedView && <nav className="feed-filter-tabs" aria-label="Feed sorting">{[["latest","Latest"],["popular","Popular"],["following","Following"]].map(([value,label]) => <button type="button" key={value} className={feedFilter === value ? "active" : ""} aria-pressed={feedFilter === value} onClick={() => { setFeedFilter(value); setVisibleLimit(20); }}>{label}</button>)}</nav>}
    {feedError && <div className="feed-notice" role="alert"><span>{feedError}</span><button type="button" onClick={loadFeed} disabled={feedLoading}>{feedLoading ? "Retrying…" : "Try again"}</button></div>}
    {notice && <div className="feed-notice" role="status"><span>{notice}</span>{lastHiddenPost && notice === "Post hidden from your feed." && <button type="button" onClick={undoHidePost}>Undo</button>}</div>}
    {feedLoading && posts.length === 0 && <section className="feed-loading-state" role="status" aria-label="Loading posts">
      <span className="sr-only">Loading posts…</span>
      {[0, 1, 2].map((item) => <article className="post-skeleton" key={item} aria-hidden="true">
        <div className="skeleton-author"><i/><span><i/><i/></span></div>
        <i className="skeleton-line skeleton-line-wide"/><i className="skeleton-line"/>
        <div className="skeleton-actions"><i/><i/></div>
      </article>)}
    </section>}
    <div className="posts-list" role="feed" aria-label="Community posts" aria-busy={feedLoading}>{visiblePosts.map((post, postIndex) => <article className="post-card" data-post-id={post.id} key={post.id} aria-label={`Post by ${post.author?.display_name || "Chatly member"}`} aria-posinset={postIndex + 1} aria-setsize={posts.length}><header className="post-author"><button className="post-author-profile" type="button" onClick={() => onOpenProfile?.(post.author)} aria-label={`View ${post.author?.display_name || "member"} profile`}>{avatar(post.author)}<span><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@"+post.author.username+" · " : ""}<time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</time></small></span></button>{post.user_id !== session.user.id && <button type="button" className={`post-follow-button ${post.following ? "is-following" : ""}`} disabled={!!followBusy[post.user_id]} aria-pressed={!!post.following} onClick={() => toggleFollowAuthor(post)}>{followBusy[post.user_id] ? "Updating…" : post.following ? "Following" : "Follow"}</button>}<div className="post-options-wrap"><button className="post-options-trigger" aria-label="More options" aria-haspopup="menu" aria-expanded={postMenu === post.id} onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}><MoreHorizontal size={20}/></button>{postMenu === post.id && <div className="post-options-menu" role="menu" aria-label="Post actions" onKeyDown={event => { const items = [...event.currentTarget.querySelectorAll("button:not(:disabled)")]; if (!items.length) return; const index = items.indexOf(document.activeElement); if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next].focus(); } else if (event.key === "Escape") { event.preventDefault(); event.currentTarget.parentElement.querySelector(".post-options-trigger")?.focus(); setPostMenu(null); } }}><button type="button" role="menuitem" onClick={() => hidePost(post)}>Not interested</button><button type="button" role="menuitem" onClick={async () => { try { await navigator.clipboard.writeText(post.body); setNotice("Post text copied."); } catch { setNotice("Copy is not available in this browser."); } setPostMenu(null); }}>Copy post text</button>{post.user_id === session.user.id ? <><button type="button" role="menuitem" onClick={() => beginEdit(post)}>Edit post</button><button className="post-delete-option" role="menuitem" disabled={deleteBusy} onClick={() => deletePost(post)}><Trash2 size={16}/>{deleteBusy ? "Deleting…" : "Delete post"}</button> </> : <button type="button" role="menuitem" onClick={() => { setNotice("Post reporting is not available yet."); setPostMenu(null); }}>Report post</button>}</div>}</div></header><p className="post-body">{imageUrlForPost(post.body) ? post.body.replace(imageUrlForPost(post.body), "").trim() : post.body}</p>{imageUrlForPost(post.body) && <figure className="post-media"><img src={imageUrlForPost(post.body)} alt="Image shared in post; activate to enlarge" role="button" tabIndex={0} onClick={() => setExpandedMediaUrl(imageUrlForPost(post.body))} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedMediaUrl(imageUrlForPost(post.body)); } }} loading="lazy" decoding="async" onError={e => { e.currentTarget.closest(".post-media")?.classList.add("post-media-unavailable"); e.currentTarget.remove(); }}/><figcaption>Shared image</figcaption></figure>}<footer className="post-actions"><span className="post-view-count" aria-label={`${Number(viewCounts[post.id]) || 0} views`}><Eye size={17}/>{(Number(viewCounts[post.id]) || 0).toLocaleString()} {Number(viewCounts[post.id]) === 1 ? "view" : "views"}</span><button type="button" className="post-share-button" aria-label="Share post" onClick={() => sharePost(post)}><Share2 size={17}/>Share</button><button type="button" className={post.liked ? "liked" : ""} disabled={!!likeBusy[post.id]} aria-pressed={post.liked} aria-busy={!!likeBusy[post.id]} aria-label={`${post.liked ? "Unlike" : "Like"} post; ${post.likes} ${post.likes === 1 ? "like" : "likes"}`} onClick={() => toggleLike(post)}><Heart size={17} fill={post.liked ? "currentColor" : "none"}/>{likeBusy[post.id] ? (post.liked ? "Liking…" : "Updating…") : `${post.likes} ${post.likes === 1 ? "like" : "likes"}`}</button><button type="button" className={post.saved ? "post-save-button saved" : "post-save-button"} disabled={!!saveBusy[post.id]} aria-pressed={!!post.saved} aria-label={post.saved ? "Remove post from saved items" : "Save post"} onClick={() => toggleSavePost(post)}><Bookmark size={17} fill={post.saved ? "currentColor" : "none"}/>{saveBusy[post.id] ? "Saving…" : post.saved ? "Saved" : "Save"}</button><button type="button" aria-label={`${openComments === post.id ? "Close" : "View"} comments for post by ${post.author?.display_name || "member"}; ${(comments[post.id] || []).length} ${(comments[post.id] || []).length === 1 ? "comment" : "comments"}`} aria-expanded={openComments === post.id} aria-controls={`comments-${post.id}`} onClick={() => { setOpenComments(openComments === post.id ? null : post.id); setCommentDraft(""); setCommentError(""); }}><MessageCircle size={17}/>{openComments === post.id && commentsLoading ? "Loading…" : `${(comments[post.id] || []).length} ${(comments[post.id] || []).length === 1 ? "comment" : "comments"}`}</button></footer></article>)}
      {!feedLoading && visiblePosts.length < orderedPosts.length && <div className="feed-load-more"><button type="button" onClick={() => setVisibleLimit(limit => limit + 20)}>Load more posts</button><span>{visiblePosts.length} of {orderedPosts.length}</span></div>}
      {!feedLoading && !visiblePosts.length && !feedError && !notice && <section className="feed-empty" aria-labelledby="feed-empty-title"><span aria-hidden="true"><MessageCircle size={26}/></span><h3 id="feed-empty-title">{savedView ? "No saved posts yet" : feedFilter === "following" ? "No posts from people you follow" : "Your feed is waiting"}</h3><p>{savedView ? "Bookmark posts from your feed and they will appear here." : feedFilter === "following" ? "Follow more people to see their posts here." : "Share a thought to get the conversation started, or discover people to follow."}</p><div className="feed-empty-actions">{savedView ? <button type="button" className="secondary-button" onClick={() => setSavedView(false)}>Back to feed</button> : <><button type="button" className="primary-button" onClick={() => setCompose(true)}>Create a post</button>{onFindFriends && <button type="button" className="secondary-button" onClick={onFindFriends}>Find people</button>}</>}</div></section>}</div>
  </div><div className="create-menu-wrap"><button className="floating-create" onClick={() => setCompose(true)} aria-label="Create a post"><Plus size={25}/></button></div>
  {openComments && <div className="modal-backdrop comment-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setOpenComments(null); }}><section className="compose-modal comments-modal" role="dialog" aria-modal="true" aria-labelledby="comments-dialog-title"><header className="comments-dialog-header"><div><h2 id="comments-dialog-title">Comments</h2><p>{(comments[openComments] || []).length} {(comments[openComments] || []).length === 1 ? "response" : "responses"} · Join the conversation</p></div><button type="button" onClick={() => { setOpenComments(null); setCommentError(""); }} aria-label="Close comments"><X size={20}/></button></header><div className="comment-list" id={`comments-${openComments}`} aria-live="polite" aria-busy={commentsLoading}>{commentsLoading ? <div className="comments-loading-state" role="status"><span className="sr-only">Loading comments…</span>{[0, 1, 2].map(item => <div className="comment-skeleton" key={item} aria-hidden="true"><i/><span><i/><i/></span></div>)}</div> : (comments[openComments] || []).map(comment => <article className={`comment-item ${comment.user_id === session.user.id ? "comment-item-own" : ""}`} key={comment.id}><button type="button" className="comment-avatar-link" onClick={() => { setOpenComments(null); onOpenProfile?.(comment.author); }} aria-label={`View ${comment.author?.display_name || "member"} profile`}>{avatar(comment.author)}</button><div className="comment-content"><div className="comment-meta"><button type="button" className="comment-name" onClick={() => { setOpenComments(null); onOpenProfile?.(comment.author); }}>{comment.author?.display_name || "Chatly member"}</button>{comment.author?.username && <span className="comment-username">@{comment.author.username}</span>}<span className="comment-meta-dot">·</span><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{comment.user_id === session.user.id && <span className="comment-you-label">You</span>}</div>{editingComment === comment.id ? <form className="comment-edit-form" onSubmit={e => { e.preventDefault(); saveCommentEdit(comment); }}><textarea value={commentEditDraft} onChange={e => setCommentEditDraft(e.target.value)} maxLength={2000} aria-label="Edit comment"/><button type="submit" disabled={commentEditBusy || !commentEditDraft.trim()}>{commentEditBusy ? "Saving…" : "Save"}</button><button type="button" disabled={commentEditBusy} onClick={() => setEditingComment(null)}>Cancel</button></form> : <div className="comment-message"><p>{comment.body}</p></div>}{comment.user_id === session.user.id && editingComment !== comment.id && <div className="comment-own-actions"><button type="button" onClick={() => startCommentEdit(comment)}>Edit</button><button type="button" onClick={() => deleteComment(comment)}>Delete</button></div>}</div></article>)}{!commentsLoading && !(comments[openComments] || []).length && <div className="comments-empty-state"><span><MessageCircle size={24}/></span><h3>Start the conversation</h3><p>Be the first to share a thought on this post.</p></div>}</div><form className="comment-composer" onSubmit={e => submitComment(e, openComments)}><button type="button" className="comment-avatar-link" onClick={() => onOpenProfile?.(profile)} aria-label="View your profile">{avatar(profile)}</button><textarea aria-label="Write a comment" aria-describedby="comment-character-count" aria-invalid={!!commentError} value={commentDraft} onChange={e => { setCommentDraft(e.target.value); if (commentError) setCommentError(""); }} placeholder="Add a thoughtful comment…" maxLength={2000} rows={1}/><small id="comment-character-count" className="comment-character-count" aria-live="polite">{commentDraft.length}/2000</small><button type="submit" disabled={commentBusy || !commentDraft.trim()}>{commentBusy ? "Sending…" : "Send"}</button>{commentError && <p className="comment-submit-error" role="alert">{commentError}</p>}</form></section></div>}
  {expandedMediaUrl && <div className="modal-backdrop media-lightbox" role="dialog" aria-modal="true" aria-label="Expanded post image" onClick={() => setExpandedMediaUrl("")}><button type="button" aria-label="Close image" onClick={() => setExpandedMediaUrl("")}><X size={20}/></button><img src={expandedMediaUrl} alt="Expanded shared post image" onClick={e => e.stopPropagation()}/></div>}
  {editingPost && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !editBusy) setEditingPost(null); }}><section className="compose-modal" role="dialog" aria-modal="true" aria-labelledby="edit-post-title"><header><h2 id="edit-post-title">Edit post</h2><button type="button" aria-label="Close edit post" disabled={editBusy} onClick={() => setEditingPost(null)}><X size={19}/></button></header><form onSubmit={saveEdit}><textarea aria-label="Edit your post" value={editDraft} onChange={e => setEditDraft(e.target.value)} maxLength={5000} autoFocus/><div className="compose-footer"><small>{editDraft.length.toLocaleString()}/5,000 characters</small><button className="primary-button" disabled={editBusy || !editDraft.trim()}>{editBusy ? "Saving…" : "Save changes"}</button></div></form></section></div>}
  {compose && <div className="modal-backdrop" onClick={e => {if(e.target===e.currentTarget && !busy)setCompose(false)}}><section className="compose-modal" role="dialog" aria-modal="true" aria-labelledby="create-post-title"><header><h2 id="create-post-title">Create a post</h2><button type="button" aria-label="Close post composer" disabled={busy} onClick={() => setCompose(false)}><X size={19}/></button></header><div className="compose-author"><button type="button" className="post-author-profile" onClick={() => onOpenProfile?.(profile)} aria-label="View your profile">{avatar(profile)}<b>{profile?.display_name || "You"}</b></button></div><form onSubmit={publish}><textarea aria-label="Write your post" aria-describedby="post-character-count" value={body} onChange={e => setBody(e.target.value)} placeholder="What's on your mind?" maxLength={5000} autoFocus/><div className="compose-footer"><small id="post-character-count" aria-live="polite" className={body.length >= 4800 ? "compose-character-count near-limit" : "compose-character-count"}>{body.length.toLocaleString()}/5,000 characters</small><button className="primary-button" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post"}</button></div></form></section></div>}
  </main>;
}
