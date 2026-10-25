import { Heart, MessageCircle, UserRound, Users, Youtube } from "lucide-react";

function Avatar({ person }) {
  return <span className="mini-avatar">{person?.avatar_url ? <img src={person.avatar_url} alt="" /> : (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase()}</span>;
}

export function PeopleResults({ people, loading, error, currentUserId, onOpenProfile, onOpenChats }) {
  return <section className="explore-result-section">
    <h2 className="search-section-title"><UserRound size={17} /> People</h2>
    <div className="search-results">
      {loading ? <p role="status">Loading people…</p> : error ? <p role="alert">{error}</p> : people.length ? people.map(person => <article className="search-person" key={person.id}>
        <button type="button" className="search-person-profile" onClick={() => onOpenProfile(person)} aria-label={`Open ${person.display_name || person.username || "member"} profile`}>
          <Avatar person={person} />
          <span><b>{person.display_name || "Chatly user"}{person.id === currentUserId ? " (You)" : ""}</b><small>{person.username ? "@" + person.username : "Chatly member"}</small></span>
        </button>
        <button type="button" onClick={() => person.id === currentUserId ? onOpenProfile(person) : onOpenChats?.(person.id)} aria-label={person.id === currentUserId ? "View profile" : "Open chat"}>
          {person.id === currentUserId ? <UserRound size={17} /> : <MessageCircle size={17} />}
        </button>
      </article>) : <p>No people found.</p>}
    </div>
  </section>;
}

export function PostResults({ posts, loading, error, onOpenProfile }) {
  return <section className="explore-result-section">
    <h2 className="search-section-title"><Heart size={17} /> Posts</h2>
    <div className="search-results">
      {loading ? <p role="status">Loading posts…</p> : error ? <p role="alert">{error}</p> : posts.length ? posts.map(post => <article className="search-post" key={post.id}>
        <button type="button" className="search-post-author" onClick={() => post.author?.id && onOpenProfile(post.author)} aria-label={`View ${post.author?.display_name || "member"} profile`}>
          <Avatar person={post.author} />
          <span><b>{post.author?.display_name || "Chatly member"}</b><small>{post.author?.username ? "@" + post.author.username : ""}</small></span>
        </button>
        <p>{post.body}</p>
        <small>{post.created_at ? new Date(post.created_at).toLocaleString() : "Recently"}</small>
      </article>) : <p>No posts found.</p>}
    </div>
  </section>;
}

export function RoomsResults() {
  return <section className="explore-result-section"><h2 className="search-section-title"><Users size={17} /> Rooms</h2><div className="search-results"><p>Rooms are not available yet.</p></div></section>;
}

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
