import { useEffect, useMemo, useState } from "react";
import { Search, MessageCircle, Heart, UserRound, Users, ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

function Avatar({ person, size = "mini-avatar" }) {
  return <span className={size}>{person?.avatar_url ? <img src={person.avatar_url} alt="" /> : (person?.display_name || person?.username || "?").slice(0,1).toUpperCase()}</span>;
}

export default function SearchPeople({ session, onOpenChats }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState("all");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const [profiles, postRows] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").order("display_name").limit(200),
        supabase.from("posts").select("id,user_id,body,created_at").order("created_at", { ascending: false }).limit(200)
      ]);
      if (!alive) return;
      if (profiles.error) setNotice(profiles.error.message);
      if (postRows.error) setNotice(postRows.error.message);
      setPeople(profiles.data || []);
      const rows = postRows.data || [];
      const ids = [...new Set(rows.map(p => p.user_id))];
      const authors = ids.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids) : { data: [] };
      const map = Object.fromEntries((authors.data || []).map(p => [p.id,p]));
      if (alive) setPosts(rows.map(p => ({ ...p, author: map[p.user_id] || {} })));
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, []);

  async function openProfile(person) {
    setSelected(person);
    setNotice("");
    const [followerRows, followingRows, mine] = await Promise.all([
      supabase.from("user_follows").select("follower_id").eq("following_id", person.id),
      supabase.from("user_follows").select("following_id").eq("follower_id", person.id),
      supabase.from("user_follows").select("follower_id").eq("follower_id", session.user.id).eq("following_id", person.id).maybeSingle()
    ]);
    setFollowers(followerRows.data?.length || 0);
    setFollowingCount(followingRows.data?.length || 0);
    setFollowing(!!mine.data);
    if (followerRows.error || followingRows.error || mine.error) {
      const err = followerRows.error || followingRows.error || mine.error;
      if (!err.message.includes("user_follows")) setNotice(err.message);
    }
  }

  async function toggleFollow() {
    if (!selected || selected.id === session.user.id || busy) return;
    setBusy(true); setNotice("");
    const result = following
      ? await supabase.from("user_follows").delete().eq("follower_id", session.user.id).eq("following_id", selected.id)
      : await supabase.from("user_follows").insert({ follower_id: session.user.id, following_id: selected.id });
    setBusy(false);
    if (result.error) { setNotice(result.error.message); return; }
    setFollowing(v => !v);
    setFollowers(v => v + (following ? -1 : 1));
  }

  const q = query.trim().toLowerCase();
  const peopleResults = useMemo(() => people.filter(p => `${p.display_name || ""} ${p.username || ""}`.toLowerCase().includes(q)), [people,q]);
  const postResults = useMemo(() => posts.filter(p => `${p.body || ""} ${p.author?.display_name || ""} ${p.author?.username || ""}`.toLowerCase().includes(q)), [posts,q]);
  const profilePosts = posts.filter(p => p.user_id === selected?.id);
  const ownProfile = selected?.id === session.user.id;

  if (selected) return <main className="search-page"><section className="profile-view">
    <button className="profile-back" onClick={() => setSelected(null)}><ArrowLeft size={17}/> Back to search</button>
    <div className="profile-hero"><Avatar person={selected} size="profile-avatar"/><div className="profile-identity"><h1>{selected.display_name || "Chatly user"}</h1><p>{selected.username ? "@" + selected.username : "Chatly member"}</p><div className="profile-stats"><span><b>{profilePosts.length}</b> posts</span><span><b>{followers}</b> followers</span><span><b>{followingCount}</b> following</span></div><div className="profile-actions">{!ownProfile && <><button className="primary-button" disabled={busy} onClick={toggleFollow}>{following ? <><UserCheck size={16}/> Following</> : <><UserPlus size={16}/> Follow</>}</button><button className="secondary-button" onClick={onOpenChats}><MessageCircle size={16}/> Chat</button></>}</div></div></div>
    <h2 className="profile-posts-title">Posts</h2>
    <div className="profile-post-grid">{profilePosts.map(post => <article className="profile-post" key={post.id}><p>{post.body}</p><small>{new Date(post.created_at).toLocaleDateString()}</small></article>)}{!profilePosts.length && <p className="profile-empty">No posts yet.</p>}</div>
    {notice && <p className="search-notice">{notice}</p>}
  </section></main>;

  return <main className="search-page"><section className="search-people">
    <h1>Explore</h1><p>Search posts, people, and groups on Chatly.</p>
    <label className="search-page-input"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search posts, people, groups…"/></label>
    <div className="search-kind-tabs">{["all","posts","people","groups"].map(t=><button key={t} className={kind===t?"active":""} onClick={()=>setKind(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
    {(kind==="all"||kind==="people") && <><h2 className="search-section-title"><UserRound size={17}/> People</h2><div className="search-results">{loading?<p>Loading people…</p>:peopleResults.length?peopleResults.map(p=><article className="search-person" key={p.id} onClick={()=>openProfile(p)} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&openProfile(p)}><Avatar person={p}/><span><b>{p.display_name||"Chatly user"}{p.id===session.user.id?" (You)":""}</b><small>{p.username?"@"+p.username:"Chatly member"}</small></span><button onClick={e=>{e.stopPropagation();if(p.id===session.user.id)openProfile(p);else onOpenChats(p.id)}} aria-label={p.id===session.user.id?"View profile":"Open chat"}>{p.id===session.user.id?<UserRound size={17}/>:<MessageCircle size={17}/>}</button></article>):<p>No people found.</p>}</div></>}
    {(kind==="all"||kind==="posts") && <><h2 className="search-section-title"><Heart size={17}/> Posts</h2><div className="search-results">{loading?<p>Loading posts…</p>:postResults.length?postResults.map(p=><article className="search-post" key={p.id}><div className="search-post-author" role="button" onClick={()=>openProfile(p.author)}><Avatar person={p.author}/><span><b>{p.author?.display_name||"Chatly member"}</b><small>{p.author?.username?"@"+p.author.username:""}</small></span></div><p>{p.body}</p><small>{new Date(p.created_at).toLocaleString()}</small></article>):<p>No posts found.</p>}</div></>}
    {(kind==="all"||kind==="groups") && <><h2 className="search-section-title"><Users size={17}/> Groups</h2><div className="search-results"><p>Groups are not available yet.</p></div></>}
    {notice && <p className="search-notice">{notice}</p>}
  </section></main>;
}
