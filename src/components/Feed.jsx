import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Plus, X, MoreHorizontal, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Feed({ session, profile, onFindFriends, onOpenProfile, onPostsChanged }) {
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [compose, setCompose] = useState(false); const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");

const [openComments, setOpenComments] = useState(null);
const [comments, setComments] = useState({});
const [commentsLoading, setCommentsLoading] = useState(true);
const [commentDraft, setCommentDraft] = useState("");
const [commentBusy, setCommentBusy] = useState(false);
const [commentError, setCommentError] = useState("");
const commentSubmitLock = useRef(false);
  const [postMenu, setPostMenu] = useState(null);
  useEffect(() => { if (postMenu === null) return; function outside(event) { if (!event.target.closest(".post-options-wrap")) setPostMenu(null); } function escape(event) { if (event.key === "Escape") setPostMenu(null); } document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [postMenu]);
  useEffect(() => { if (!compose) return; function closeOnEscape(event) { if (event.key === "Escape" && !busy) setCompose(false); } document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [compose, busy]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState({});
  const [followBusy, setFollowBusy] = useState({});
  const requestId = useRef(0);
  async function loadFeed() {
    const request = ++requestId.current;
    setFeedLoading(true);
    setCommentsLoading(true);
    setNotice("");
    try {
    const { data, error } = await supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) { if (request === requestId.current) setNotice(`Could not load feed: ${error.message}`); return; }
    const ids = [...new Set((data || []).map(p => p.user_id))];
    const { data: profiles, error: profilesError } = ids.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids) : { data: [], error: null };
    if (profilesError) throw profilesError;
    const map = Object.fromEntries((profiles || []).map(p => [p.id,p]));
    const postIds = (data || []).map(post => post.id);
    const [likesResult, followsResult] = await Promise.all([
      postIds.length ? supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
      supabase.from("user_follows").select("following_id").eq("follower_id", session.user.id)
    ]);
    if (likesResult.error) throw likesResult.error;
    if (followsResult.error) throw followsResult.error;
    const likes = likesResult.data || [];
    const followedRows = followsResult.data || [];
    const followedIds = new Set((followedRows || []).map(row => row.following_id));
    // Keep one record per post even if a joined/merged response contains duplicates.
    const postRows = [...new Map((data || []).map(post => [post.id, post])).values()];
    if (request !== requestId.current) return;
    setPosts(postRows.map(p => ({
      ...p,
      author: map[p.user_id] || {},
      likes: likes.filter(l => l.post_id === p.id).length,
      liked: likes.some(l => l.post_id === p.id && l.user_id === session.user.id),
      following: followedIds.has(p.user_id)
    })));
    if (postRows.length) { const { data: commentRows, error: commentsError } = await supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", postRows.map(p => p.id)).order("created_at"); if (commentsError) throw commentsError; const commentIds = [...new Set((commentRows || []).map(c => c.user_id))]; const { data: commentProfiles, error: commentProfilesError } = commentIds.length ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", commentIds) : { data: [], error: null }; if (commentProfilesError) throw commentProfilesError; const authors = Object.fromEntries((commentProfiles || []).map(p => [p.id,p])); if (request !== requestId.current) return; setComments(Object.fromEntries(postRows.map(p => [p.id,(commentRows || []).filter(c => c.post_id === p.id).map(c => ({...c,author:authors[c.user_id] || {}}))]))); } else { if (request !== requestId.current) return; setComments({}); }
    } catch (error) {
      console.error("Feed load failed:", error);
      if (request === requestId.current) setNotice("The feed could not be refreshed. Please try again.");
    }
    finally { if (request === requestId.current) { setFeedLoading(false); setCommentsLoading(false); } }
  }
  useEffect(() => { loadFeed(); return () => { requestId.current += 1; }; }, []);
  async function publish(e) { e.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setNotice(""); try { const { error } = await supabase.from("posts").insert({ user_id:session.user.id, body:body.trim() }); if (error) throw error; setBody(""); setCompose(false); await Promise.all([loadFeed(), onPostsChanged?.()]); } catch (error) { setNotice(error.message || "Your post could not be published. Please try again."); } finally { setBusy(false); } }
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
  async function toggleFollowAuthor(post) { if (post.user_id === session.user.id || followBusy[post.user_id]) return; const wasFollowing = !!post.following; setFollowBusy(v => ({...v,[post.user_id]:true})); setNotice(""); try { const result = wasFollowing ? await supabase.from("user_follows").delete().eq("follower_id",session.user.id).eq("following_id",post.user_id) : await supabase.from("user_follows").insert({follower_id:session.user.id,following_id:post.user_id}); if (result.error) throw result.error; setPosts(current => current.map(p => p.user_id === post.user_id ? {...p,following:!wasFollowing} : p)); } catch(error) { setNotice(error.message || "Could not update follow."); } finally { setFollowBusy(v => ({...v,[post.user_id]:false})); } }
  async function submitComment(e, postId) { e.preventDefault(); const text = commentDraft.trim(); if (!text || commentSubmitLock.current) return; commentSubmitLock.current = true; setCommentBusy(true); setCommentError(""); setNotice(""); try { const { data, error } = await supabase.from("post_comments").insert({post_id:postId,user_id:session.user.id,body:text}).select("id,post_id,user_id,body,created_at").single(); if (error) throw error; const newComment = { ...data, author: { id: session.user.id, display_name: profile?.display_name || "You", username: profile?.username || "", avatar_url: profile?.avatar_url || "" } }; setComments(current => ({ ...current, [postId]: [...(current[postId] || []), newComment] })); setCommentDraft(""); } catch (error) { setCommentError(error.message || "Could not send your comment. Your draft is still here—please try again."); } finally { commentSubmitLock.current = false; setCommentBusy(false); } }
  const avatar = (p) => <span className="mini-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt=""/> : (p?.display_name || "C").slice(0,1).toUpperCase()}</span>;
  return <main className="feed-page"><div className="feed-column">
    <div className="feed-heading-row"><div><h1>Your feed</h1><p>Updates from the Chatly community</p></div></div>
    {notice && <div className="feed-notice" role="status"><span>{notice}</span>{notice.toLowerCase().includes("load") || notice.toLowerCase().includes("refresh") ? <button type="button" onClick={loadFeed}>Try again</button> : null}</div>}
    {feedLoading && posts.length === 0 && <section className="feed-loading-state" role="status" aria-label="Loading posts">
      <span className="sr-only">Loading posts…</span>
      {[0, 1, 2].map((item) => <article className="post-skeleton" key={item} aria-hidden="true">
        <div className="skeleton-author"><i/><span><i/><i/></span></div>
        <i className="skeleton-line skeleton-line-wide"/><i className="skeleton-line"/>
        <div className="skeleton-actions"><i/><i/></div>
      </article>)}
    </section>}
    <div className="posts-list">{posts.map(post => <article className="post-card" key={post.id}><header className="post-author"><button className="post-author-profile" type="button" onClick={() => onOpenProfile?.(post.author)} aria-label={`View ${post.author?.display_name || "member"} profile`}>{avatar(post.author)}<span><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@"+post.author.username+" · " : ""}{new Date(post.created_at).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</small></span></button>{<div className="post-options-wrap"><button className="post-options-trigger" aria-label="More options" aria-haspopup="menu" aria-expanded={postMenu === post.id} onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}><MoreHorizontal size={20}/></button>{postMenu === post.id && <div className="post-options-menu">{post.user_id !== session.user.id && <button type="button" onClick={() => toggleFollowAuthor(post)} disabled={!!followBusy[post.user_id]}>{post.following ? "Unfollow" : "Follow"} {post.author?.username ? "@"+post.author.username : "author"}</button>}<button type="button" onClick={async () => { try { await navigator.clipboard.writeText(post.body); setNotice("Post text copied."); } catch { setNotice("Copy is not available in this browser."); } setPostMenu(null); }}>Copy post text</button>{post.user_id === session.user.id ? <button className="post-delete-option" disabled={deleteBusy} onClick={() => deletePost(post)}><Trash2 size={16}/>{deleteBusy ? "Deleting…" : "Delete post"}</button> : <button type="button" onClick={() => { setNotice("Thanks. This post has been flagged for review."); setPostMenu(null); }}>Report post</button>}</div>}</div>}</header><p className="post-body">{post.body}</p><footer className="post-actions"><button type="button" className={post.liked ? "liked" : ""} disabled={!!likeBusy[post.id]} aria-pressed={post.liked} aria-busy={!!likeBusy[post.id]} aria-label={`${post.liked ? "Unlike" : "Like"} post; ${post.likes} ${post.likes === 1 ? "like" : "likes"}`} onClick={() => toggleLike(post)}><Heart size={17} fill={post.liked ? "currentColor" : "none"}/>{post.likes} likes</button><button type="button" aria-label={`${openComments === post.id ? "Close" : "View"} comments for post by ${post.author?.display_name || "member"}; ${(comments[post.id] || []).length} ${(comments[post.id] || []).length === 1 ? "comment" : "comments"}`} aria-expanded={openComments === post.id} aria-controls={`comments-${post.id}`} onClick={() => { setOpenComments(openComments === post.id ? null : post.id); setCommentDraft(""); }}><MessageCircle size={17}/>{(comments[post.id] || []).length} comments</button></footer></article>)}
      {!feedLoading && !posts.length && !notice && <div className="feed-empty"><span><MessageCircle size={26}/></span><h3>{"No posts yet"}</h3><p>{"Be the first to share something with the community."}</p><button type="button" className="primary-button" onClick={() => setCompose(true)}>Create a post</button></div>}</div>
  </div><div className="create-menu-wrap"><button className="floating-create" onClick={() => setCompose(true)} aria-label="Create a post"><Plus size={25}/></button></div>
  {openComments && <div className="modal-backdrop comment-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setOpenComments(null); }}><section className="compose-modal comments-modal" role="dialog" aria-modal="true" aria-labelledby="comments-dialog-title"><header className="comments-dialog-header"><div><h2 id="comments-dialog-title">Comments</h2><p>{(comments[openComments] || []).length} {(comments[openComments] || []).length === 1 ? "response" : "responses"} · Join the conversation</p></div><button type="button" onClick={() => setOpenComments(null)} aria-label="Close comments"><X size={20}/></button></header><div className="comment-list" id={`comments-${openComments}`} aria-live="polite" aria-busy={commentsLoading}>{commentsLoading ? <div className="comments-loading-state" role="status"><span className="sr-only">Loading comments…</span>{[0, 1, 2].map(item => <div className="comment-skeleton" key={item} aria-hidden="true"><i/><span><i/><i/></span></div>)}</div> : (comments[openComments] || []).map(comment => <article className={`comment-item ${comment.user_id === session.user.id ? "comment-item-own" : ""}`} key={comment.id}><button type="button" className="comment-avatar-link" onClick={() => { setOpenComments(null); onOpenProfile?.(comment.author); }} aria-label={`View ${comment.author?.display_name || "member"} profile`}>{avatar(comment.author)}</button><div className="comment-content"><div className="comment-meta"><button type="button" className="comment-name" onClick={() => { setOpenComments(null); onOpenProfile?.(comment.author); }}>{comment.author?.display_name || "Chatly member"}</button>{comment.author?.username && <span className="comment-username">@{comment.author.username}</span>}<span className="comment-meta-dot">·</span><time>{new Date(comment.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>{comment.user_id === session.user.id && <span className="comment-you-label">You</span>}</div><div className="comment-message"><p>{comment.body}</p></div></div></article>)}{!commentsLoading && !(comments[openComments] || []).length && <div className="comments-empty-state"><span><MessageCircle size={24}/></span><h3>Start the conversation</h3><p>Be the first to share a thought on this post.</p></div>}</div><form className="comment-composer" onSubmit={e => submitComment(e, openComments)}><button type="button" className="comment-avatar-link" onClick={() => onOpenProfile?.(profile)} aria-label="View your profile">{avatar(profile)}</button><textarea aria-label="Write a comment" aria-describedby="comment-character-count" aria-invalid={!!commentError} value={commentDraft} onChange={e => { setCommentDraft(e.target.value); if (commentError) setCommentError(""); }} placeholder="Add a thoughtful comment…" maxLength={2000} rows={1}/><small id="comment-character-count" className="comment-character-count" aria-live="polite">{commentDraft.length}/2000</small><button type="submit" disabled={commentBusy || !commentDraft.trim()}>{commentBusy ? "Sending…" : "Send"}</button>{commentError && <p className="comment-submit-error" role="alert">{commentError}</p>}</form></section></div>}
  {compose && <div className="modal-backdrop" onClick={e => {if(e.target===e.currentTarget && !busy)setCompose(false)}}><section className="compose-modal" role="dialog" aria-modal="true" aria-labelledby="create-post-title"><header><h2 id="create-post-title">Create a post</h2><button type="button" aria-label="Close post composer" disabled={busy} onClick={() => setCompose(false)}><X size={19}/></button></header><div className="compose-author"><button type="button" className="post-author-profile" onClick={() => onOpenProfile?.(profile)} aria-label="View your profile">{avatar(profile)}<b>{profile?.display_name || "You"}</b></button></div><form onSubmit={publish}><textarea aria-label="Write your post" aria-describedby="post-character-count" value={body} onChange={e => setBody(e.target.value)} placeholder="What's on your mind?" maxLength={5000} autoFocus/><div className="compose-footer"><small id="post-character-count" aria-live="polite" className={body.length >= 4800 ? "compose-character-count near-limit" : "compose-character-count"}>{body.length.toLocaleString()}/5,000 characters</small><button className="primary-button" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post"}</button></div></form></section></div>}
  </main>;
}
