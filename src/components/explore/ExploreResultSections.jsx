import { Fragment } from "react";
import { Heart, MessageCircle, UserRound, Users, Youtube } from "lucide-react";

function Avatar({ person }) {
  return <span className="mini-avatar">{person?.avatar_url ? <img src={person.avatar_url} alt="" /> : (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase()}</span>;
}

function HighlightMatch({ text, query }) {
  const value = String(text || "");
  const terms = query.trim().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!value || !terms.length) return value;
  const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "ig");
  return value.split(pattern).map((part, index) =>
    terms.some(term => part.toLowerCase() === term.toLowerCase())
      ? <mark key={index}>{part}</mark>
      : <Fragment key={index}>{part}</Fragment>
  );
}

function formatPostDate(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function PeopleResults({ people, loading, error, hasMore, onLoadMore, currentUserId, onOpenProfile, onOpenChats }) {
  return <section className="explore-result-section">
    <h2 className="search-section-title"><UserRound size={17} /> People</h2>
    <div className="search-results">
      {error && <p role="alert">{error}</p>}
      {people.length ? people.map(person => {
        const isCurrentUser = person.id === currentUserId;
        const displayName = person.display_name || person.username || "Chatly user";
        return <article className="search-person" key={person.id}>
          <button type="button" className="search-person-profile" onClick={() => onOpenProfile(person)} aria-label={`View ${displayName} profile`}>
            <Avatar person={person} />
            <span className="search-person-details">
              <b>{person.display_name || "Chatly user"}{isCurrentUser ? " (You)" : ""}</b>
              <small>{person.username ? "@" + person.username : "Chatly member"}</small>
              {person.bio?.trim() && <small className="search-person-bio">{person.bio.trim()}</small>}
            </span>
          </button>
          <button
            type="button"
            className="search-person-action"
            onClick={() => isCurrentUser ? onOpenProfile(person) : onOpenChats?.(person.id)}
            aria-label={isCurrentUser ? "View your profile" : `Message ${displayName}`}
            title={isCurrentUser ? "View profile" : "Message"}
          >
            {isCurrentUser ? <><UserRound size={16} /><span>Profile</span></> : <><MessageCircle size={16} /><span>Message</span></>}
          </button>
        </article>;
      }) : !loading && !error ? <p>No people found. Try another name or username.</p> : null}
      {loading && <p role="status">Loading people…</p>}
      {hasMore && !loading && <button type="button" className="explore-load-more" onClick={onLoadMore}>Load more people</button>}
    </div>
  </section>;
}

export function PostResults({ posts, loading, error, hasMore, onLoadMore, onOpenProfile, query = "" }) {
  return <section className="explore-result-section">
    <h2 className="search-section-title"><Heart size={17} /> Posts</h2>
    <div className="search-results">
      {error && <p role="alert">{error}</p>}
      {posts.length ? posts.map(post => <article className="search-post" key={post.id}>
        <button type="button" className="search-post-author" onClick={() => post.author?.id && onOpenProfile(post.author)} aria-label={`View ${post.author?.display_name || "member"} profile`}>
          <Avatar person={post.author} />
          <span><b><HighlightMatch text={post.author?.display_name || "Chatly member"} query={query} /></b><small>{post.author?.username ? "@" + post.author.username : ""}</small></span>
        </button>
        <p className="search-post-body"><HighlightMatch text={post.body} query={query} /></p>
        <time dateTime={post.created_at || undefined} title={post.created_at ? new Date(post.created_at).toLocaleString() : undefined}>{formatPostDate(post.created_at)}</time>
      </article>) : !loading && !error ? <p>No posts found. Try different keywords.</p> : null}
      {loading && <p role="status">Loading posts…</p>}
      {hasMore && !loading && <button type="button" className="explore-load-more" onClick={onLoadMore}>Load more posts</button>}
    </div>
  </section>;
}

export function RoomsResults() {\n  return <section className="explore-result-section"><h2 className="search-section-title"><Users size={17} /> Rooms</h2><div className="search-results"><p>Room discovery is not connected to a rooms directory yet. You can still discover people and posts using the other Explore categories.</p></div></section>;\n}

export function YouTubeResults({ videos, loading, error, onPlayVideo }) {
  return <section className="explore-result-section">
    <h2 className="search-section-title"><Youtube size={17} /> Songs on YouTube</h2>
    <div className="youtube-results">
      {loading ? <p role="status">Searching YouTube…</p> : error ? <p role="alert">{error}</p> : videos.length ? videos.map(video => <button className="youtube-result" type="button" key={video.id.videoId} onClick={() => onPlayVideo?.(video)}>
        <img src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url} alt="" />
        <span><b>{video.snippet.title}</b><small>{video.snippet.channelTitle}</small></span>
      </button>) : <p>No YouTube videos found.</p>}
    </div>
  </section>;
}
