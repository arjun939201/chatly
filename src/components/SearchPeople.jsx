import { useEffect, useMemo, useState } from "react";
import { Search, MessageCircle, Heart, UserRound, Users, ArrowLeft, UserPlus, UserCheck, X, Maximize2, Youtube } from "lucide-react";
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
  const [videos, setVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);

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


  useEffect(() => {
    const searchKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!query.trim()) { setVideos([]); setVideoError(""); setVideoLoading(false); return; }
    if (!searchKey) { setVideos([]); setVideoError("YouTube search requires VITE_YOUTUBE_API_KEY in the app environment."); setVideoLoading(false); return; }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setVideoLoading(true); setVideoError("");
      try {
        const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "20", q: query.trim(), key: searchKey });
        const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString());
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");
        if (alive) setVideos(data.items || []);
      } catch (error) { if (alive) { setVideos([]); setVideoError(error.message || "Unable to search YouTube."); } }
      finally { if (alive) setVideoLoading(false); }
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query]);

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
  const activeVideoId = expandedVideo?.id?.videoId;

  if (selected) return <main className="search-page"><section className="profile-view">
    <button className="profile-back" onClick={() => setSelected(null)}><ArrowLeft size={17}/> Back to search</button>
    <div className="profile-hero"><Avatar person={selected} size="profile-avatar"/><div className="profile-identity"><h1>{selected.display_name || "Chatly user"}</h1><p>{selected.username ? "@" + selected.username : "Chatly member"}</p><div className="profile-stats"><span><b>{profilePosts.length}</b> posts</span><span><b>{followers}</b> followers</span><span><b>{followingCount}</b> following</span></div><div className="profile-actions">{!ownProfile && <><button className="primary-button" disabled={busy} onClick={toggleFollow}>{following ? <><UserCheck size={16}/> Following</> : <><UserPlus size={16}/> Follow</>}</button><button className="secondary-button" onClick={onOpenChats}><MessageCircle size={16}/> Chat</button></>}</div></div></div>
    <h2 className="profile-posts-title">Posts</h2>
    <div className="profile-post-grid">{profilePosts.map(post => <article className="profile-post" key={post.id}><p>{post.body}</p><small>{new Date(post.created_at).toLocaleDateString()}</small></article>)}{!profilePosts.length && <p className="profile-empty">No posts yet.</p>}</div>
    {notice && <p className="search-notice">{notice}</p>}
  </section></main>;

  return <main className="search-page"><section className="search-people">
    <h1>Explore</h1><p>Discover people, rooms, posts, and YouTube videos.</p>
    <label className="search-page-input"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people, rooms, posts, videos…"/></label>
    {query.trim() ? <div className="search-kind-tabs">{["people","rooms","posts","youtube"].map(t=><button key={t} className={kind===t?"active":""} onClick={()=>setKind(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div> : <div className="search-start-prompt"><Search size={24}/><strong>Search anything on Chatly</strong><p>Find people by name or ID, discover rooms, browse posts, and search YouTube videos.</p></div>}
    {q && <>
    {(kind==="people") && <><h2 className="search-section-title"><UserRound size={17}/> People</h2><div className="search-results">{loading?<p>Loading people…</p>:peopleResults.length?peopleResults.map(p=><article className="search-person" key={p.id} onClick={()=>openProfile(p)} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&openProfile(p)}><Avatar person={p}/><span><b>{p.display_name||"Chatly user"}{p.id===session.user.id?" (You)":""}</b><small>{p.username?"@"+p.username:"Chatly member"}</small></span><button onClick={e=>{e.stopPropagation();if(p.id===session.user.id)openProfile(p);else onOpenChats(p.id)}} aria-label={p.id===session.user.id?"View profile":"Open chat"}>{p.id===session.user.id?<UserRound size={17}/>:<MessageCircle size={17}/>}</button></article>):<p>No people found.</p>}</div></>}
    {(kind==="posts") && <><h2 className="search-section-title"><Heart size={17}/> Posts</h2><div className="search-results">{loading?<p>Loading posts…</p>:postResults.length?postResults.map(p=><article className="search-post" key={p.id}><div className="search-post-author" role="button" onClick={()=>openProfile(p.author)}><Avatar person={p.author}/><span><b>{p.author?.display_name||"Chatly member"}</b><small>{p.author?.username?"@"+p.author.username:""}</small></span></div><p>{p.body}</p><small>{new Date(p.created_at).toLocaleString()}</small></article>):<p>No posts found.</p>}</div></>}
    {(kind==="rooms") && <><h2 className="search-section-title"><Users size={17}/> Rooms</h2><div className="search-results"><p>Rooms are not available yet.</p></div></>}
    {(kind==="youtube") && <><h2 className="search-section-title"><Youtube size={17}/> YouTube videos</h2><div className="youtube-results">{!q?<p>Search for videos to see YouTube results.</p>:videoLoading?<p>Searching YouTube…</p>:videoError?<p>{videoError.includes("VITE_YOUTUBE_API_KEY")?"YouTube search needs a VITE_YOUTUBE_API_KEY configured in your deployment.":videoError}</p>:videos.length?videos.map(video=><button className="youtube-result" key={video.id.videoId} onClick={()=>{setExpandedVideo(video);setPlayerFullscreen(false)}}><img src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url} alt=""/><span><b>{video.snippet.title}</b><small>{video.snippet.channelTitle}</small></span></button>):<p>No YouTube videos found.</p>}</div></>}
    </>}
    {expandedVideo && <div className="youtube-player-backdrop" onClick={()=>{setExpandedVideo(null);setPlayerFullscreen(false)}}><section className={playerFullscreen?"youtube-player-modal fullscreen":"youtube-player-modal"} onClick={event=>event.stopPropagation()}><header><span>{expandedVideo.snippet.title}</span><div><button aria-label="Full screen" onClick={()=>setPlayerFullscreen(v=>!v)}><Maximize2 size={18}/></button><button aria-label="Close video" onClick={()=>{setExpandedVideo(null);setPlayerFullscreen(false)}}><X size={20}/></button></div></header><iframe title={expandedVideo.snippet.title} src={"https://www.youtube.com/embed/"+activeVideoId+"?autoplay=1&rel=0"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></section></div>}
    {notice && <p className="search-notice">{notice}</p>}
  </section></main>;
}
