import { useEffect, useState } from "react";
import { Heart, MessageCircle, Plus, Users, Search, X } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Feed({ session, profile, onFindFriends }) {
  const [posts, setPosts] = useState([]); const [people, setPeople] = useState([]);
  const [compose, setCompose] = useState(false); const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [friendMenu, setFriendMenu] = useState(false); const [search, setSearch] = useState("");
  async function loadFeed() {
    const { data, error } = await supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) { setNotice(error.message); return; }
    const ids = [...new Set((data || []).map(p => p.user_id))];
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids) : { data: [] };
    const map = Object.fromEntries((profiles || []).map(p => [p.id,p]));
    const { data: likes } = await supabase.from("post_likes").select("post_id,user_id");
    setPosts((data || []).map(p => ({ ...p, author: map[p.user_id] || {}, likes: (likes || []).filter(l => l.post_id === p.id).length, liked: (likes || []).some(l => l.post_id === p.id && l.user_id === session.user.id) })));
  }
  useEffect(() => { loadFeed(); }, []);
  async function loadPeople() { const { data, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url").neq("id",session.user.id).order("display_name").limit(100); if (error) setNotice(error.message); else setPeople(data || []); }
  async function publish(e) { e.preventDefault(); if (!body.trim()) return; setBusy(true); setNotice(""); const { error } = await supabase.from("posts").insert({ user_id:session.user.id, body:body.trim() }); setBusy(false); if (error) { setNotice(error.message); return; } setBody(""); setCompose(false); await loadFeed(); }
  async function toggleLike(post) { const { data: existing } = await supabase.from("post_likes").select("post_id").eq("post_id",post.id).eq("user_id",session.user.id).maybeSingle(); const result = existing ? await supabase.from("post_likes").delete().eq("post_id",post.id).eq("user_id",session.user.id) : await supabase.from("post_likes").insert({post_id:post.id,user_id:session.user.id}); if (result.error) { setNotice(result.error.message); return; } await loadFeed(); }
  const avatar = (p) => <span className="mini-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt=""/> : (p?.display_name || "C").slice(0,1).toUpperCase()}</span>;
  return <main className="feed-page"><div className="feed-column">
    <div className="feed-heading"><div><span className="eyebrow">YOUR COMMUNITY</span><h1>Home feed</h1><p>See what's happening around Chatly.</p></div>
      <div className="find-friends-wrap"><button className="find-friends-btn" onClick={() => { const open = !friendMenu; setFriendMenu(open); if (open) loadPeople(); }}><Users size={17}/> Find friends <span>⌄</span></button>
      {friendMenu && <div className="friends-dropdown"><div className="dropdown-title">Discover people <button onClick={() => setFriendMenu(false)}><X size={15}/></button></div><div className="friend-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or username"/></div>
        {people.filter(p => `${p.display_name || ""} ${p.username || ""}`.toLowerCase().includes(search.toLowerCase())).slice(0,12).map(p => <button className="friend-option" key={p.id} onClick={() => { setFriendMenu(false); onFindFriends(); }}><span className="mini-avatar">{p.avatar_url ? <img src={p.avatar_url} alt=""/> : (p.display_name || "C").slice(0,1).toUpperCase()}</span><span><b>{p.display_name || "Chatly user"}</b><small>{p.username ? "@"+p.username : "Chatly member"}</small></span><MessageCircle size={16}/></button>)}
        {!people.length && <p className="dropdown-empty">No members found yet.</p>}</div>}</div>
    </div>
    <button className="feed-composer" onClick={() => setCompose(true)}>{avatar(profile)}<span>Share something with the community…</span><Plus size={18}/></button>
    {notice && <p className="feed-notice">{notice}</p>}
    <div className="posts-list">{posts.map(post => <article className="post-card" key={post.id}><header className="post-author">{avatar(post.author)}<div><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@"+post.author.username+" · " : ""}{new Date(post.created_at).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}</small></div></header><p className="post-body">{post.body}</p><footer className="post-actions"><button className={post.liked ? "liked" : ""} onClick={() => toggleLike(post)}><Heart size={17} fill={post.liked ? "currentColor" : "none"}/>{post.likes} likes</button><button onClick={() => onFindFriends()}><MessageCircle size={17}/> Chat</button></footer></article>)}
      {!posts.length && <div className="feed-empty"><span><MessageCircle size={26}/></span><h3>Your feed starts here</h3><p>Share a thought or find people to connect with.</p><button onClick={() => setCompose(true)}>Create your first post</button></div>}</div>
  </div><button className="floating-create" onClick={() => setCompose(true)} aria-label="Create post"><Plus size={25}/></button>
  {compose && <div className="modal-backdrop" onClick={e => {if(e.target===e.currentTarget)setCompose(false)}}><section className="compose-modal"><header><h2>Create a post</h2><button onClick={() => setCompose(false)}><X size={19}/></button></header><div className="compose-author">{avatar(profile)}<b>{profile?.display_name || "You"}</b></div><form onSubmit={publish}><textarea value={body} onChange={e => setBody(e.target.value)} placeholder="What's on your mind?" maxLength={5000} autoFocus/><div className="compose-footer"><small>{body.length}/5000</small><button className="primary-button" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post"}</button></div></form></section></div>}
  </main>;
}
