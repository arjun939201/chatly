import { useEffect, useMemo, useState } from "react";
import { Search, MessageCircle, Heart, UserRound, Users, X, Youtube } from "lucide-react";
import { supabase } from "../lib/supabase";

function Avatar({ person, size = "mini-avatar" }) {
  return <span className={size}>{person?.avatar_url ? <img src={person.avatar_url} alt="" /> : (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase()}</span>;
}

export default function SearchPeople({ session, requestedProfile, onProfileRequestHandled, onOpenProfile, onOpenChats, onPlayVideo }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [peopleError, setPeopleError] = useState("");
  const [postsError, setPostsError] = useState("");
  const [kind, setKind] = useState("all");
  const [videos, setVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    if (!requestedProfile) return;
    onOpenProfile?.(requestedProfile);
    onProfileRequestHandled?.();
  }, [requestedProfile]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setPeopleError("");
      setPostsError("");

      const [profilesResult, postsResult] = await Promise.all([
        supabase.from("profiles")
          .select("id,username,display_name,avatar_url,bio")
          .order("display_name")
          .limit(200),
        supabase.from("posts")
          .select("id,user_id,body,created_at")
          .order("created_at", { ascending: false })
          .limit(200)
      ]);

      if (!alive) return;

      if (profilesResult.error) setPeopleError("People could not be loaded. Please try again.");
      setPeople(profilesResult.data || []);

      if (postsResult.error) {
        setPostsError("Posts could not be loaded. Please try again.");
        setPosts([]);
        setLoading(false);
        return;
      }

      const rows = postsResult.data || [];
      const authorIds = [...new Set(rows.map(post => post.user_id).filter(Boolean))];
      const authorsResult = authorIds.length
        ? await supabase.from("profiles")
            .select("id,username,display_name,avatar_url")
            .in("id", authorIds)
        : { data: [], error: null };

      if (!alive) return;
      if (authorsResult.error) setPostsError("Post authors could not be loaded. Please try again.");

      const authorsById = Object.fromEntries((authorsResult.data || []).map(person => [person.id, person]));
      setPosts(rows.map(post => ({ ...post, author: authorsById[post.user_id] || {} })));
      setLoading(false);
    }

    load().catch(error => {
      if (!alive) return;
      console.error("Explore data load failed:", error);
      setPeopleError("People could not be loaded. Please try again.");
      setPostsError("Posts could not be loaded. Please try again.");
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const searchKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (kind !== "songs" || !query.trim()) {
      setVideos([]);
      setVideoError("");
      setVideoLoading(false);
      return;
    }
    if (!searchKey) {
      setVideos([]);
      setVideoError("YouTube search needs a VITE_YOUTUBE_API_KEY configured in your deployment.");
      setVideoLoading(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setVideoLoading(true);
      setVideoError("");
      try {
        const params = new URLSearchParams({
          part: "snippet",
          type: "video",
          videoCategoryId: "10",
          maxResults: "20",
          q: query.trim(),
          key: searchKey
        });
        const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");
        if (alive) setVideos(data.items || []);
      } catch (error) {
        if (alive && error.name !== "AbortError") {
          setVideos([]);
          setVideoError(error.message || "Unable to search YouTube.");
        }
      } finally {
        if (alive) setVideoLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind]);

  const q = query.trim().toLowerCase();
  const peopleResults = useMemo(
    () => people.filter(person => `${person.display_name || ""} ${person.username || ""}`.toLowerCase().includes(q)),
    [people, q]
  );
  const postResults = useMemo(
    () => posts.filter(post => `${post.body || ""} ${post.author?.display_name || ""} ${post.author?.username || ""}`.toLowerCase().includes(q)),
    [posts, q]
  );

  function openProfile(person) {
    if (person?.id) onOpenProfile?.(person);
  }

  function renderPeopleResults() {
    return <section className="explore-result-section">
      <h2 className="search-section-title"><UserRound size={17} /> People</h2>
      <div className="search-results">
        {loading ? <p role="status">Loading people…</p>
          : peopleError ? <p role="alert">{peopleError}</p>
          : peopleResults.length ? peopleResults.map(person => <article className="search-person" key={person.id}>
            <button type="button" className="search-person-profile" onClick={() => openProfile(person)} aria-label={`Open ${person.display_name || person.username || "member"} profile`}>
              <Avatar person={person} />
              <span><b>{person.display_name || "Chatly user"}{person.id === session.user.id ? " (You)" : ""}</b><small>{person.username ? "@" + person.username : "Chatly member"}</small></span>
            </button>
            <button type="button" onClick={() => person.id === session.user.id ? openProfile(person) : onOpenChats?.(person.id)} aria-label={person.id === session.user.id ? "View profile" : "Open chat"}>
              {person.id === session.user.id ? <UserRound size={17} /> : <MessageCircle size={17} />}
            </button>
          </article>)
          : <p>No people found.</p>}
      </div>
    </section>;
  }

  function renderPostResults() {
    return <section className="explore-result-section">
      <h2 className="search-section-title"><Heart size={17} /> Posts</h2>
      <div className="search-results">
        {loading ? <p role="status">Loading posts…</p>
          : postsError ? <p role="alert">{postsError}</p>
          : postResults.length ? postResults.map(post => <article className="search-post" key={post.id}>
            <button type="button" className="search-post-author" onClick={() => openProfile(post.author)} aria-label={`View ${post.author?.display_name || "member"} profile`}>
              <Avatar person={post.author} />
              <span><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@" + post.author.username : ""}</small></span>
            </button>
            <p>{post.body}</p>
            <small>{post.created_at ? new Date(post.created_at).toLocaleString() : "Recently"}</small>
          </article>)
          : <p>No posts found.</p>}
      </div>
    </section>;
  }

  return <main className="search-page">
    <section className="search-people">
      <h1>Explore</h1>
      <p>Discover people, rooms, posts, and songs.</p>
      <label className="search-page-input">
        <Search size={18} />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people, rooms, posts, songs…" aria-label="Search Explore" />
        {query && <button type="button" className="search-clear-button" onClick={() => setQuery("")} aria-label="Clear search"><X size={17} /></button>}
      </label>

      {q ? <div className="search-kind-tabs" role="tablist" aria-label="Explore categories">
        {["all", "people", "posts", "rooms", "songs"].map(category => <button
          type="button"
          role="tab"
          key={category}
          aria-selected={kind === category}
          className={kind === category ? "active" : ""}
          onClick={() => setKind(category)}
        >{category === "all" ? "All" : category[0].toUpperCase() + category.slice(1)}</button>)}
      </div> : <div className="search-start-prompt">
        <Search size={24} />
        <strong>Search anything on Chatly</strong>
        <p>Find people by name or ID, discover rooms, browse posts, and search songs.</p>
      </div>}

      {q && <>
        {(kind === "all" || kind === "people") && renderPeopleResults()}
        {(kind === "all" || kind === "posts") && renderPostResults()}
        {kind === "rooms" && <section className="explore-result-section">
          <h2 className="search-section-title"><Users size={17} /> Rooms</h2>
          <div className="search-results"><p>Rooms are not available yet.</p></div>
        </section>}
        {kind === "songs" && <section className="explore-result-section">
          <h2 className="search-section-title"><Youtube size={17} /> Songs on YouTube</h2>
          <div className="youtube-results">
            {videoLoading ? <p role="status">Searching YouTube…</p>
              : videoError ? <p role="alert">{videoError}</p>
              : videos.length ? videos.map(video => <button className="youtube-result" type="button" key={video.id.videoId} onClick={() => onPlayVideo?.(video)}>
                <img src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url} alt="" />
                <span><b>{video.snippet.title}</b><small>{video.snippet.channelTitle}</small></span>
              </button>)
              : <p>No YouTube videos found.</p>}
          </div>
        </section>}
      </>}
    </section>
  </main>;
}
