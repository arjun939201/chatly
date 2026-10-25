import { useEffect, useRef, useState } from "react";
import { Search, Send, MessageCircle, Users, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";

function Avatar({ person, className = "" }) {
  const label = (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase();
  return <span className={`avatar ${className}`}>{person?.avatar_url ? <img src={person.avatar_url} alt=""/> : label}</span>;
}

export default function Chat({ session, profile }) {
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.from("profiles").select("id, username, display_name, avatar_url")
      .neq("id", session.user.id).order("display_name")
      .then(({ data, error: err }) => { if (err) setError(err.message); else setPeople(data || []); });
  }, [session.user.id, profile]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let alive = true;
    const load = async () => {
      const { data, error: err } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${session.user.id})`)
        .order("created_at", { ascending: true });
      if (alive) { if (err) setError(err.message); else setMessages(data || []); }
    };
    load();
    const channel = supabase.channel(`chat-${[session.user.id, active.id].sort().join("-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        const m = payload.new;
        if ((m.sender_id === session.user.id && m.recipient_id === active.id) || (m.sender_id === active.id && m.recipient_id === session.user.id)) {
          setMessages(current => current.some(item => item.id === m.id) ? current : [...current, m]);
        }
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [active, session.user.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !active) return;
    setDraft("");
    const { error: err } = await supabase.from("messages").insert({ sender_id: session.user.id, recipient_id: active.id, body });
    if (err) { setDraft(body); setError(err.message); }
  }

  const visiblePeople = people.filter(p => `${p.username || ""} ${p.display_name || ""}`.toLowerCase().includes(query.toLowerCase()));

  return <main className={`chat-layout ${active ? "has-active" : ""}`}>
    <aside className="sidebar">
      <div className="sidebar-heading"><div><Users size={18}/> People</div><span>{people.length}</span></div>
      <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find people…"/></div>
      <div className="people-list">
        {visiblePeople.map(person => <button key={person.id} className={`person-row ${active?.id === person.id ? "selected" : ""}`} onClick={() => { setActive(person); setError(""); }}>
          <Avatar person={person}/>
          <span className="person-copy"><strong>{person.display_name || person.username || "Chatly user"}</strong><small>{person.username ? `@${person.username}` : "Chatly member"}</small></span>
        </button>)}
        {!visiblePeople.length && <p className="empty-small">{query ? "No matches found." : "No other users yet. Invite a friend to sign up!"}</p>}
      </div>
    </aside>
    <section className="conversation">
      {active ? <>
        <header className="conversation-header"><button className="mobile-back" onClick={() => setActive(null)} aria-label="Back to people"><ArrowLeft size={18}/></button><Avatar person={active}/><div><strong>{active.display_name || active.username || "Chatly user"}</strong><small>{active.username ? `@${active.username}` : "Chatly member"}</small></div></header>
        <div className="message-list">
          {messages.map(m => <div key={m.id} className={`message ${m.sender_id === session.user.id ? "mine" : "theirs"}`}><div className="bubble">{m.body}<time>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div></div>)}
          {!messages.length && <div className="empty-chat"><MessageCircle size={32}/><p>Say hello to {active.display_name || active.username || "your new connection"}!</p></div>}
          <div ref={bottomRef}/>
        </div>
        <form className="composer" onSubmit={sendMessage}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" maxLength={4000}/><button className="send-button" disabled={!draft.trim()} aria-label="Send message"><Send size={18}/></button></form>
      </> : <div className="welcome-chat"><span className="welcome-icon"><MessageCircle size={32}/></span><h2>Your conversations, together.</h2><p>Choose someone from the people list to start chatting.</p></div>}
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    </section>
  </main>;
}