import { useEffect, useRef, useState } from "react";
import {
  Activity, ArrowRight, Compass, Gamepad2, Hash, MessageCircle,
  PlayCircle, RefreshCw, Search, Sparkles, TrendingUp, Users, X
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const categories = [
  { id: "videos", title: "Videos", description: "Find something worth watching", icon: PlayCircle, tone: "coral", status: "Coming soon" },
  { id: "games", title: "Games", description: "Take a quick play break", icon: Gamepad2, tone: "blue", status: "Play now" },
  { id: "rooms", title: "Rooms", description: "Join conversations around interests", icon: MessageCircle, tone: "violet", status: "Coming soon" },
  { id: "trending", title: "Trending", description: "Catch up with the community", icon: TrendingUp, tone: "amber", status: "Explore" },
  { id: "people", title: "People", description: "Discover people on Chatly", icon: Users, tone: "green", status: "Find people" },
  { id: "activities", title: "Activities", description: "Events, challenges, and more", icon: Activity, tone: "pink", status: "Coming soon" }
];

const gameChoices = [
  { id: "rock", label: "Rock", emoji: "✊" },
  { id: "paper", label: "Paper", emoji: "✋" },
  { id: "scissors", label: "Scissors", emoji: "✌️" }
];

function getGameResult(player, computer) {
  if (player === computer) return "It's a tie. Go again!";
  const wins = { rock: "scissors", paper: "rock", scissors: "paper" };
  return wins[player] === computer ? "You win this round!" : "Chatly wins this round!";
}

export default function ExploreHome({ onSearch }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [gameRound, setGameRound] = useState(null);
  const requestId = useRef(0);
  const postsSectionRef = useRef(null);

  function formatRecentDate(value) {
    if (!value) return "Recently";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  async function loadRecentPosts() {
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const { data, error: postsError } = await supabase.from("posts")
        .select("id,user_id,body,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (postsError) throw postsError;
      if (request !== requestId.current) return;
      const rows = (Array.isArray(data) ? data : []).filter(post => post && post.id != null);
      const authorIds = [...new Set(rows.map(post => post.user_id).filter(id => typeof id === "string" && id.length > 0))];
      const { data: profiles, error: profilesError } = authorIds.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", authorIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      if (request !== requestId.current) return;
      const authorMap = Object.fromEntries((profiles || []).map(person => [person.id, person]));
      setPosts(rows.map(post => ({ ...post, body: typeof post.body === "string" ? post.body : "", author: authorMap[post.user_id] || {} })));
    } catch {
      if (request === requestId.current) setError("Community posts are unavailable right now. Please try again.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadRecentPosts();
    return () => { requestId.current += 1; };
  }, []);

  function selectCategory(category) {
    setActiveCategory(current => current === category ? "" : category);
    setGameRound(null);
    if (category === "trending") {
      window.setTimeout(() => postsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
    if (category === "people") onSearch?.("");
  }

  function playRound(player) {
    const computer = gameChoices[Math.floor(Math.random() * gameChoices.length)].id;
    setGameRound({ player, computer, result: getGameResult(player, computer) });
  }

  return <section className="explore-home" aria-label="Explore discovery home">
    <div className="explore-welcome">
      <div className="explore-welcome-copy">
        <span className="explore-eyebrow"><Sparkles size={14} /> YOUR NEXT DISCOVERY</span>
        <h2>Find your next favorite thing.</h2>
        <p>Watch, play, meet people, and find conversations beyond your feed.</p>
      </div>
      <div className="explore-welcome-art" aria-hidden="true"><Compass size={42} strokeWidth={1.4} /><span /><i /></div>
    </div>

    <button type="button" className="explore-open-search" onClick={() => onSearch?.("")}>
      <Search size={18} aria-hidden="true" /><span>Search people and posts</span><ArrowRight size={16} className="explore-search-arrow" aria-hidden="true" />
    </button>

    <section className="explore-category-section" aria-labelledby="explore-categories-title">
      <div className="explore-section-intro">
        <div><h3 id="explore-categories-title">Explore your way</h3><p>Choose what you're in the mood for.</p></div>
      </div>
      <div className="explore-category-grid">
        {categories.map(category => {
          const Icon = category.icon;
          const selected = activeCategory === category.id;
          return <button type="button" key={category.id} className={`explore-category-card explore-tone-${category.tone}${selected ? " is-selected" : ""}`}
            aria-pressed={selected} onClick={() => selectCategory(category.id)}>
            <span className="explore-category-icon"><Icon size={21} strokeWidth={1.9} /></span>
            <span className="explore-category-copy"><b>{category.title}</b><small>{category.description}</small></span>
            <span className={`explore-category-status${category.status === "Coming soon" ? " is-upcoming" : ""}`}>{category.status}</span>
          </button>;
        })}
      </div>
    </section>

    {activeCategory && <section className="explore-category-detail" aria-live="polite">
      <div className="explore-category-detail-head">
        <div><span className="explore-eyebrow">EXPLORE EXPERIENCE</span><h3>{categories.find(item => item.id === activeCategory)?.title}</h3></div>
        <button type="button" className="explore-detail-close" onClick={() => { setActiveCategory(""); setGameRound(null); }} aria-label="Close category"><X size={18} /></button>
      </div>
      {activeCategory === "games" ? <div className="explore-quick-game">
        <div className="explore-game-heading"><span className="explore-game-badge"><Gamepad2 size={19} /></span><div><h4>Rock, Paper, Scissors</h4><p>A quick round while you explore.</p></div></div>
        <div className="explore-game-choices">{gameChoices.map(choice => <button type="button" key={choice.id} onClick={() => playRound(choice.id)} aria-label={`Choose ${choice.label}`}><span>{choice.emoji}</span><b>{choice.label}</b></button>)}</div>
        {gameRound && <div className="explore-game-result" role="status"><p>{gameRound.result}</p><span>You: {gameChoices.find(item => item.id === gameRound.player)?.emoji} <span aria-hidden="true">·</span> Chatly: {gameChoices.find(item => item.id === gameRound.computer)?.emoji}</span></div>}
      </div> : activeCategory === "trending" ? <div className="explore-category-message"><TrendingUp size={21} /><div><b>Fresh from the community</b><p>See the latest public conversations below. Popularity rankings can come later when reliable engagement signals are available.</p></div><button type="button" onClick={() => postsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>View posts <ArrowRight size={15} /></button></div>
      : activeCategory === "people" ? <div className="explore-category-message"><Users size={21} /><div><b>Find your people</b><p>Search names, usernames, or shared interests to discover Chatly members.</p></div><button type="button" onClick={() => onSearch?.("")}>Open search <ArrowRight size={15} /></button></div>
      : <div className="explore-category-message"><Sparkles size={21} /><div><b>{activeCategory === "videos" ? "Video discovery is on the roadmap" : activeCategory === "rooms" ? "Rooms are on the roadmap" : "More ways to connect are coming"}</b><p>{activeCategory === "videos" ? "A dedicated watch experience needs a reliable video source and playback flow." : activeCategory === "rooms" ? "We're laying the groundwork for room membership, realtime conversations, and moderation." : "Events and interactive community activities will arrive in a later phase."}</p></div><span className="explore-coming-label">In development</span></div>}
    </section>}

    <section className="explore-topic-discovery" aria-label="Explore topics">
      <h3><Hash size={16} /> Explore by interest <span>Choose a topic to find related conversations</span></h3>
      <div className="explore-discovery-actions">
        {["Technology", "Gaming", "Music", "Learning", "Art", "Sports", "Books", "Fitness"].map(topic => <button key={topic} type="button" onClick={() => onSearch?.(topic)}>{topic}</button>)}
      </div>
    </section>

    <section className="explore-community-section" ref={postsSectionRef} aria-labelledby="explore-community-title">
      <div className="explore-home-section-heading">
        <div><h3 id="explore-community-title"><TrendingUp size={17} /> Fresh from the community</h3><p>Recent public posts from Chatly members</p></div>
        <button type="button" onClick={loadRecentPosts} disabled={loading} aria-label={loading ? "Refreshing recent posts" : "Refresh recent posts"} title={loading ? "Refreshing…" : "Refresh recent posts"}><RefreshCw size={15} /></button>
      </div>
      {loading ? <p role="status" className="explore-home-status">Loading recent posts…</p>
        : error ? <div className="explore-home-status" role="alert"><span>{error}</span><button type="button" onClick={loadRecentPosts} disabled={loading}>Retry</button></div>
        : posts.length ? <div className="explore-home-posts">{posts.map(post => <article className="explore-home-post" key={post.id}>
            <div className="explore-home-post-author"><span className="explore-home-post-avatar">{post.author.avatar_url ? <img src={post.author.avatar_url} alt="" loading="lazy" /> : (post.author.display_name || post.author.username || "C").slice(0,1).toUpperCase()}</span><span>{post.author.display_name || post.author.username || "Chatly member"}{post.author.username ? <small> @{post.author.username}</small> : null}</span></div>
            <p>{post.body}</p>
            <time dateTime={post.created_at || undefined}>{formatRecentDate(post.created_at)}</time>
          </article>)}</div>
        : <p className="explore-home-status">No public posts yet. Be the first to start a conversation.</p>}
    </section>
  </section>;
}
