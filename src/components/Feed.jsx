import { useEffect, useState } from "react";
import { Heart, MessageCircle, Plus, Users, Search, X } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Feed({ session, profile, onFindFriends }) {
  const [posts, setPosts] = useState([]); const [people, setPeople] = useState([]);
  const [compose, setCompose] = useState(false); const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [friendMenu, setFriendMenu] = useState(false);
const [search, setSearch] = useState("");
const [createMenu, setCreateMenu] = useState(false);

const [openComments, setOpenComments] = useState(null);
const [comments, setComments] = useState({});
const [commentDraft, setCommentDraft] = useState("");
const [commentBusy, setCommentBusy] = useState(false);
  async function loadFeed() {
    const { data, error } = await supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) { setNotice(error.message); return; }
    const ids = [...new Set((data || []).map(p => p.user_id))];
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids) : { data: [] };
    const map = Object.fromEntries((profiles || []).map(p => [p.id,p]));
    const { data: likes } = await supabase.from("post_likes").select("post_id,user_id");
    const postRows = data || [];\n    setPosts(postRows.map(p => ({ ...p, author: map[p.user_id] || {}, likes: (likes || []).filter(l => l.post_id === p.id).length, liked: (likes || []).some(l => l.post_id === p.id && l.user_id === session.user.id) })));\n    if (postRows.length) { const { data: commentRows } = await supabase.from("post_comments").select("id,post_id,user_id,body,created_at").in("post_id", postRows.map(p => p.id)).order("created_at"); const commentIds = [...new Set((commentRows || []).map(c => c.user_id))]; const { data: commentProfiles } = commentIds.length ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", commentIds) : { data: [] }; const authors = Object.fromEntries((commentProfiles || []).map(p => [p.id,p])); setComments(Object.fromEntries(postRows.map(p => [p.id,(commentRows || []).filter(c => c.post_id === p.id).map(c => ({...c,author:authors[c.user_id] || {}}))]))); } else setComments({});
  }
  useEffect(() => { loadFeed(); }, []);
  async function loadPeople() { const { data, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url").neq("id",session.user.id).order("display_name").limit(100); if (error) setNotice(error.message); else setPeople(data || []); }
  async function publish(e) { e.preventDefault(); if (!body.trim()) return; setBusy(true); setNotice(""); const { error } = await supabase.from("posts").insert({ user_id:session.user.id, body:body.trim() }); setBusy(false); if (error) { setNotice(error.message); return; } setBody(""); setCompose(false); await loadFeed(); }
  async function toggleLike(post) { const { data: existing } = await supabase.from("post_likes").select("post_id").eq("post_id",post.id).eq("user_id",session.user.id).maybeSingle(); const result = existing ? await supabase.from("post_likes").delete().eq("post_id",post.id).eq("user_id",session.user.id) : await supabase.from("post_likes").insert({post_id:post.id,user_id:session.user.id}); if (result.error) { setNotice(result.error.message); return; } await loadFeed(); }
  async function submitComment(e, postId) { e.preventDefault(); if (!commentDraft.trim()) return; setCommentBusy(true); const { error } = await supabase.from("post_comments").insert({post_id:postId,user_id:session.user.id,body:commentDraft.trim()}); setCommentBusy(false); if (error) { setNotice(error.message); return; } setCommentDraft(""); await loadFeed(); }\n  const avatar = (p) => <span className="mini-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt=""/> : (p?.display_name || "C").slice(0,1).toUpperCase()}</span>;
  return <main className="feed-page"><div className="feed-column">
    <button className="feed-composer" onClick={() => setCompose(true)}>{avatar(profile)}<span>Share something with the community…</span><Plus size={18}/></button>
    {notice && <p className="feed-notice">{notice}</p>}
    <div className="posts-list">{posts.map(post => <article className="post-card" key={post.id}><header className="post-author">{avatar(post.author)}<div><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@"+post.author.username+" · " : ""}{new Date(post.created_at).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</small></div></header><p className="post-body">{post.body}</p><footer className="post-actions"><button className={post.liked ? "liked" : ""} onClick={() => toggleLike(post)}><Heart size={17} fill={post.liked ? "currentColor" : "none"}/>{post.likes} likes</button><button onClick={() => { setOpenComments(openComments === post.id ? null : post.id); setCommentDraft(""); }}><MessageCircle size={17}/>{(comments[post.id] || []).length} comments</button></footer>{openComments === post.id && <section className="post-comments"><div className="comment-list">{(comments[post.id] || []).map(comment => <div className="post-comment" key={comment.id}>{avatar(comment.author)}<div><b>{comment.author?.display_name || "Chatly member"}</b><p>{comment.body}</p></div></div>)}{!(comments[post.id] || []).length && <p className="no-comments">No comments yet. Start the conversation.</p>}</div><form className="comment-composer" onSubmit={e => submitComment(e, post.id)}>{avatar(profile)}<input value={openComments === post.id ? commentDraft : ""} onChange={e => setCommentDraft(e.target.value)} placeholder="Write a comment…" maxLength={2000}/><button disabled={commentBusy || !commentDraft.trim()}>{commentBusy ? "…" : "Send"}</button></form></section>}</article>)}
      {!posts.length && <div className="feed-empty"><span><MessageCircle size={26}/></span><h3>No posts yet</h3><p>Be the first to share something with the community.</p></div>}</div>
  </div><div className="create-menu-wrap"><button className="floating-create" onClick={() => setCreateMenu(v => !v)} aria-label="Open create menu" aria-expanded={createMenu}><Plus size={25}/></button>{createMenu && <div className="create-menu"><button onClick={() => { setCreateMenu(false); setCompose(true); }}><Plus size={17}/> Create post</button><button onClick={() => { setCreateMenu(false); setFriendMenu(true); loadPeople(); }}><Users size={17}/> Find friends</button><button onClick={() => { setCreateMenu(false); onFindFriends(); }}><MessageCircle size={17}/> Open chats</button></div>}</div>
  {compose && <div className="modal-backdrop" onClick={e => {if(e.target===e.currentTarget)setCompose(false)}}><section className="compose-modal"><header><h2>Create a post</h2><button onClick={() => setCompose(false)}><X size={19}/></button></header><div className="compose-author">{avatar(profile)}<b>{profile?.display_name || "You"}</b></div><form onSubmit={publish}><textarea value={body} onChange={e => setBody(e.target.value)} placeholder="What's on your mind?" maxLength={5000} autoFocus/><div className="compose-footer"><small>{body.length}/5000</small><button className="primary-button" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post"}</button></div></form></section></div>}
  </main>;
}
