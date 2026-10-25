import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

function Avatar({ person }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person?.avatar_url]);
  return <span className="profile-avatar">{person?.avatar_url && !failed ? <img src={person.avatar_url} alt="" onError={() => setFailed(true)} /> : (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase()}</span>;
}

export default function PublicProfile({ person, session, onBack, onOpenChats }) {
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const ownProfile = person?.id === session?.user?.id;

  useEffect(() => {
    let alive = true;
    const currentRequest = ++request.current;
    async function load() {
      if (!person?.id) { setLoading(false); return; }
      setLoading(true); setNotice("");
      const [postResult, followerResult, followingResult, relationResult] = await Promise.all([
        supabase.from("posts").select("id,body,created_at").eq("user_id", person.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", person.id),
        supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", person.id),
        ownProfile ? Promise.resolve({ data: null, error: null }) : supabase.from("user_follows").select("follower_id").eq("follower_id", session.user.id).eq("following_id", person.id).maybeSingle()
      ]);
      if (!alive || currentRequest !== request.current) return;
      const error = postResult.error || followerResult.error || followingResult.error || relationResult.error;
      if (error) setNotice("Some profile details could not be loaded. Please try again.");
      setPosts(postResult.data || []);
      setFollowers(followerResult.count || 0);
      setFollowingCount(followingResult.count || 0);
      setIsFollowing(!!relationResult.data);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [person?.id, session?.user?.id, ownProfile]);

  async function toggleFollow() {
    if (ownProfile || busy || !person?.id) return;
    setBusy(true); setNotice("");
    const wasFollowing = isFollowing;
    const result = wasFollowing
      ? await supabase.from("user_follows").delete().eq("follower_id", session.user.id).eq("following_id", person.id)
      : await supabase.from("user_follows").insert({ follower_id: session.user.id, following_id: person.id });
    if (result.error) setNotice(result.error.message || "Could not update follow status.");
    else { setIsFollowing(!wasFollowing); setFollowers(count => Math.max(0, count + (wasFollowing ? -1 : 1))); }
    setBusy(false);
  }

  return <main className="search-page public-profile-page"><section className="profile-view">
    <button className="profile-back" type="button" onClick={onBack}><ArrowLeft size={17}/> Back</button>
    <div className="profile-hero"><Avatar person={person}/><div className="profile-identity"><h1>{person?.display_name || "Chatly user"}</h1><p>{person?.username ? "@" + person.username : "Chatly member"}</p>{person?.bio && <p className="profile-bio-text">{person.bio}</p>}<div className="profile-stats" aria-label="Profile statistics"><span><b>{posts.length}</b> posts</span><span><b>{followers}</b> followers</span><span><b>{followingCount}</b> following</span></div>{loading && <p className="profile-loading-status" role="status">Loading profile details…</p>}<div className="profile-actions">{!ownProfile && <><button className="primary-button" disabled={busy || loading} onClick={toggleFollow}>{busy ? "Updating…" : loading ? "Loading…" : isFollowing ? <><UserCheck size={16}/> Following</> : <><UserPlus size={16}/> Follow</>}</button><button className="secondary-button" type="button" onClick={() => onOpenChats?.(person.id)}><MessageCircle size={16}/> Chat</button></>}</div></div></div>
    <h2 className="profile-posts-title">Posts</h2>
    {loading ? <p className="profile-empty">Loading posts…</p> : <div className="profile-post-grid">{posts.map(post => <article className="profile-post" key={post.id}><p>{post.body}</p><small>{post.created_at ? new Date(post.created_at).toLocaleDateString() : "Recently"}</small></article>)}{!posts.length && <p className="profile-empty">No posts yet.</p>}</div>}
    {notice && <p className="search-notice" role="status">{notice}</p>}
  </section></main>;
}
