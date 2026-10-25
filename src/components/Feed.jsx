import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Plus, X, MoreHorizontal, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Feed({ session, profile, onFindFriends, onPostsChanged }) {
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedScope, setFeedScope] = useState("all");
  const [compose, setCompose] = useState(false); const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [friendMenu, setFriendMenu] = useState(false);
const [search, setSearch] = useState("");
const [createMenu, setCreateMenu] = useState(false);
useEffect(() => {
  if (!createMenu) return;
  function closeOnOutsideClick(event) {
    if (!event.target.closest(".create-menu-wrap")) setCreateMenu(false);
  }
  document.addEventListener("pointerdown", closeOnOutsideClick);
  return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
}, [createMenu]);

const [openComments, setOpenComments] = useState(null);
const [comments, setComments] = useState({});
const [commentDraft, setCommentDraft] = useState("");
const [commentBusy, setCommentBusy] = useState(false);
  const [postMenu, setPostMenu] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState({});
  const requestId = useRef(0);
  async function loadFeed() {
    const request = ++requestId.current;
    setFeedLoading(true);
    setNotice("");
    try {
    let followedIds = [];
    if (feedScope === "following") {
      const { data: follows, error: followError } = await supabase.from("user_follows").select("following_id").eq("follower_id", session.user.id);
      if (followError) { if (request === requestId.current) setNotice(`Could not load following feed: ${followError.message}`); return; }
      followedIds = (follows || []).map(row => row.following_id);
      if (!followedIds.length) { if (request === requestId.current) { setPosts([]); setComments({}); } return; }
    }
    let postQuery = supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(100);
    if (feedScope === "following") postQuery = postQuery.in("user_id", followedIds);
    const { data, error } = await postQuery;
    if (error) { if (request === requestId.current) setNotice(`Could not load feed: ${error.message}`); return; }
    const ids = [...new Set((data || []).map(p => p.user_id))];
    const { data: profiles, error: profilesError } = ids.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids) : { data: [], error: null };
    if (profilesError) throw profilesError;
    const map = Object.fromEntries((profiles || []).map(p => [p.id,p]));
    const { data: likes, error: likesError } = await supabase.from("post_likes").select("post_id,user_id");
    if (likesError) throw likesError;
    const postRows = data || [];
    if (request !== requestId.current) return;
    setPosts(postRows.map(p => ({ ...p, author: map[p.user_id] || {}, likes: (likes || []).filter(l => l.post_id === p.id).length, liked: (likes || []).some(l => l.post_id === p.id && l.user_id === session.user.id) })));
    if (postRows.length) { const { data: commentRows, error: commentsError } = await supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", postRows.map(p => p.id)).order("created_at"); if (commentsError) throw commentsError; const commentIds = [...new Set((commentRows || []).map(c => c.user_id))]; const { data: commentProfiles, error: commentProfilesError } = commentIds.length ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", commentIds) : { data: [], error: null }; if (commentProfilesError) throw commentProfilesError; const authors = Object.fromEntries((commentProfiles || []).map(p => [p.id,p])); if (request !== requestId.current) return; setComments(Object.fromEntries(postRows.map(p => [p.id,(commentRows || []).filter(c => c.post_id === p.id).map(c => ({...c,author:authors[c.user_id] || {}}))]))); } else { if (request !== requestId.current) return; setComments({}); }
    } catch (error) { if (request === requestId.current) setNotice(`Could not load feed: ${error.message || "Please try again."}`); }
    finally { if (request === requestId.current) setFeedLoading(false); }
  }
  useEffect(() => { loadFeed(); return () => { requestId.current += 1; }; }, [feedScope]);
  async function publish(e) { e.preventDefault(); if (!body.trim()) return; setBusy(true); setNotice(""); const { error } = await supabase.from("posts").insert({ user_id:session.user.id, body:body.trim() }); setBusy(false); if (error) { setNotice(error.message); return; } setBody(""); setCompose(false); await Promise.all([loadFeed(), onPostsChanged?.()]); }
  async function deletePost(post) {
    if (post.user_id !== session.user.id) return;
    if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;
    setDeleteBusy(true); setNotice("");
    const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", session.user.id);
    setDeleteBusy(false); setPostMenu(null);
    if (error) { setNotice(error.message); return; }
    if (openComments === post.id) setOpenComments(null);
    await Promise.all([loadFeed(), onPostsChanged?.()]);
  }
  async function toggleLike(post) { if (likeBusy[post.id]) return; setLikeBusy(current => ({ ...current, [post.id]: true })); setNotice(""); try { const { data: existing, error: lookupError } = await supabase.from("post_likes").select("post_id").eq("post_id",post.id).eq("user_id",session.user.id).maybeSingle(); if (lookupError) throw lookupError; const result = existing ? await supabase.from("post_likes").delete().eq("post_id",post.id).eq("user_id",session.user.id) : await supabase.from("post_likes").insert({post_id:post.id,user_id:session.user.id}); if (result.error) throw result.error; await loadFeed(); } catch (error) { setNotice(error.message || "Could not update like."); } finally { setLikeBusy(current => ({ ...current, [post.id]: false })); } }
  async function submitComment(e, postId) { e.preventDefault(); const text = commentDraft.trim(); if (!text || commentBusy) return; setCommentBusy(true); setNotice(""); try { const { error } = await supabase.from("post_comments").insert({post_id:postId,user_id:session.user.id,body:text}); if (error) throw error; setCommentDraft(""); await loadFeed(); } catch (error) { setNotice(error.message || "Could not send comment."); } finally { setCommentBusy(false); } }
  const avatar = (p) => <span className="mini-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt=""/> : (p?.display_name || "C").slice(0,1).toUpperCase()}</span>;
  return <main className="feed-page"><div className="feed-column">
    <button className="feed-composer" onClick={() => setCompose(true)}>{avatar(profile)}<span>Share something with the community…</span><Plus size={18}/></button>
    {notice && <p className="feed-notice" role="status">{notice}</p>}
    {feedLoading && <p className="feed-loading" role="status">Loading posts…</p>}
    <div className="posts-list">{posts.map(post => <article className="post-card" key={post.id}><header className="post-author">{avatar(post.author)}<div><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@"+post.author.username+" · " : ""}{new Date(post.created_at).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</small></div>{post.user_id === session.user.id && <div className="post-options-wrap"><button className="post-options-trigger" aria-label="Post options" aria-expanded={postMenu === post.id} onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}><MoreHorizontal size={20}/></button>{postMenu === post.id && <div className="post-options-menu"><button className="post-delete-option" disabled={deleteBusy} onClick={() => deletePost(post)}><Trash2 size={16}/>{deleteBusy ? "Deleting…" : "Delete post"}</button></div>}</div>}</header><p className="post-body">{post.body}</p><footer className="post-actions"><button className={post.liked ? "liked" : ""} disabled={!!likeBusy[post.id]} aria-pressed={post.liked} onClick={() => toggleLike(post)}><Heart size={17} fill={post.liked ? "currentColor" : "none"}/>{post.likes} likes</button><button onClick={() => { setOpenComments(openComments === post.id ? null : post.id); setCommentDraft(""); }}><MessageCircle size={17}/>{(comments[post.id] || []).length} comments</button></footer></article>)}
      {!feedLoading && !posts.length && <div className="feed-empty"><span><MessageCircle size={26}/></span><h3>{feedScope === "following" ? "Your following feed is quiet" : "No posts yet"}</h3><p>{feedScope === "following" ? "Follow people in Explore to see their posts here." : "Be the first to share something with the community."}</p></div>}</div>
  </div><div className="create-menu-wrap"><button className="floating-create" onClick={() => setCreateMenu(v => !v)} aria-label="Open create menu" aria-expanded={createMenu}><Plus size={25}/></button>{createMenu && <div className="create-menu"><button onClick={() => { setCreateMenu(false); setCompose(true); }}><Plus size={17}/> Create post</button></div>}</div>
  {openComments && <div className="modal-backdrop comment-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setOpenComments(null); }}><section className="compose-modal comments-modal"><header><h2>Comments</h2><button onClick={() => setOpenComments(null)} aria-label="Close comments"><X size={19}/></button></header><div className="comment-list">{(comments[openComments] || []).map(comment => <div className="post-comment" key={comment.id}>{avatar(comment.author)}<div><b>{comment.author?.display_name || "Chatly member"}</b><p>{comment.body}</p></div></div>)}{!(comments[openComments] || []).length && <p className="no-comments">No comments yet. Start the conversation.</p>}</div><form className="comment-composer" onSubmit={e => submitComment(e, openComments)}>{avatar(profile)}<input value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Write a comment…" maxLength={2000}/><button disabled={commentBusy || !commentDraft.trim()}>{commentBusy ? "Sending…" : "Send"}</button></form></section></div>}
  {compose && <div className="modal-backdrop" onClick={e => {if(e.target===e.currentTarget)setCompose(false)}}><section className="compose-modal"><header><h2>Create a post</h2><button onClick={() => setCompose(false)}><X size={19}/></button></header><div className="compose-author">{avatar(profile)}<b>{profile?.display_name || "You"}</b></div><form onSubmit={publish}><textarea value={body} onChange={e => setBody(e.target.value)} placeholder="What's on your mind?" maxLength={5000} autoFocus/><div className="compose-footer"><small>{body.length}/5000</small><button className="primary-button" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post"}</button></div></form></section></div>}
  </main>;
}
