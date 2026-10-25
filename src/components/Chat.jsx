import { useEffect, useRef, useState } from "react";
import { Search, Send, MessageCircle, Users, ArrowLeft, Bookmark, SquarePen, ChevronLeft, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

function Avatar({ person, className = "" }) {
  const label = (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase();
  return <span className={`avatar ${className}`}>{person?.avatar_url ? <img src={person.avatar_url} alt=""/> : label}</span>;
}

export default function Chat({ session, profile, targetId, enterToSend = true, onBackToFeed }) {
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [messageActionBusy, setMessageActionBusy] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [lastMessages, setLastMessages] = useState({});
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.from("messages").select("id,sender_id,recipient_id,body,created_at").or("sender_id.eq." + session.user.id + ",recipient_id.eq." + session.user.id).order("created_at", { ascending: false }).limit(250)
      .then(({ data }) => { if (!data) return; const latest = {}; data.forEach(message => { const peer = message.sender_id === session.user.id ? message.recipient_id : message.sender_id; if (!latest[peer]) latest[peer] = message; }); setLastMessages(latest); });
  }, [session.user.id]);

  useEffect(() => {
    supabase.from("profiles").select("id, username, display_name, avatar_url")
      .order("display_name")
      .then(({ data, error: err }) => { if (err) setError(err.message); else setPeople(data || []); });
  }, [session.user.id, profile]);

  useEffect(() => {
    if (targetId) {
      const target = people.find(person => person.id === targetId) || (targetId === session.user.id ? profile : null);
      if (target) setActive(target);
    }
  }, [targetId, people, profile, session.user.id]);

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
    if (!body || !active || sendBusy) return;
    const recipientId = active.id;
    setSendBusy(true);
    setError("");
    setDraft("");
    try {
      const { error: err } = await supabase.from("messages").insert({ sender_id: session.user.id, recipient_id: recipientId, body });
      if (err && active?.id === recipientId) { setDraft(body); setError(err.message); }
    } catch (err) {
      if (active?.id === recipientId) {
        setDraft(body);
        setError(err?.message || "Could not send message. Please try again.");
      }
    } finally {
      setSendBusy(false);
    }
  }

  async function deleteMessage(message) {
    if (message.sender_id !== session.user.id || messageActionBusy) return;
    if (!window.confirm("Delete this message?")) return;
    setMessageActionBusy(message.id);
    setError("");
    const { error: deleteError } = await supabase.from("messages").delete().eq("id", message.id).eq("sender_id", session.user.id);
    if (deleteError) setError(deleteError.message || "Could not delete message.");
    else setMessages(current => current.filter(item => item.id !== message.id));
    setMessageActionBusy(null);
  }

  const self = { ...(profile || {}), id: session.user.id, display_name: "Saved messages", username: "You", avatar_url: profile?.avatar_url };
  const visiblePeople = [self, ...people.filter(p => p.id !== session.user.id)].filter(p => `${p.username || ""} ${p.display_name || ""}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "saved" && p.id === session.user.id) || (filter === "people" && p.id !== session.user.id) || filter === "unread"));

  return <main className={`chat-layout ${active ? "has-active" : ""}`}>
    <aside className="sidebar">
      <div className="sidebar-heading"><div className="chat-heading-title"><button className="chat-feed-back" onClick={onBackToFeed} aria-label="Back to feed"><ChevronLeft size={20}/></button><MessageCircle size={20}/> <span>Chats</span></div><button className="chat-new-button" aria-label="New chat" onClick={() => { setFilter("all"); setQuery(""); setActive(null); }}><SquarePen size={18}/></button></div>
      <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chats…"/></div>
      <div className="chat-filter-row">{[["all","All"],["people","People"],["saved","Saved"]].map(([key,label])=><button key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{label}</button>)}</div><div className="people-list">
        {visiblePeople.map(person => <button key={person.id} className={`person-row ${active?.id === person.id ? "selected" : ""}`} onClick={() => { setActive(person); setError(""); }}>
          <Avatar person={person}/>
          <span className="person-copy"><strong>{person.id === session.user.id ? "Saved messages" : person.display_name || person.username || "Chatly user"}</strong><small>{lastMessages[person.id] ? `${lastMessages[person.id].sender_id === session.user.id ? "You: " : ""}${lastMessages[person.id].body}` : person.id === session.user.id ? "Your personal space for notes" : person.username ? `@${person.username}` : "Chatly member"}</small></span><time className="chat-row-time">{lastMessages[person.id] ? new Date(lastMessages[person.id].created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</time>
        </button>)}
        {!visiblePeople.length && <p className="empty-small">{query ? "No matches found." : "No conversations yet. Start a new chat!"}</p>}
      </div>
    </aside>
    <section className="conversation">
      {active ? <>
        <header className="conversation-header"><button className="mobile-back" onClick={() => setActive(null)} aria-label="Back to people"><ArrowLeft size={18}/></button><Avatar person={active}/><div><strong>{active.id === session.user.id ? "Saved messages" : active.display_name || active.username || "Chatly user"}</strong><small>{active.id === session.user.id ? "Only you" : active.username ? `@${active.username}` : "Chatly member"}</small></div></header>
        <div className="message-list">
          {messages.map(m => <div key={m.id} className={`message ${m.sender_id === session.user.id ? "mine" : "theirs"}`}><div className="bubble">{m.body}<time>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{m.sender_id === session.user.id && <button type="button" className="message-delete" aria-label="Delete message" title="Delete message" disabled={messageActionBusy === m.id} onClick={() => deleteMessage(m)}><Trash2 size={13}/></button>}</div></div>)}
          {!messages.length && <div className="empty-chat"><MessageCircle size={32}/><p>{active.id === session.user.id ? "Save a note, link, or message for yourself." : `Say hello to ${active.display_name || active.username || "your new connection"}!`}</p></div>}
          <div ref={bottomRef}/>
        </div>
        <form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && enterToSend) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={enterToSend ? "Write a message… (Shift+Enter for new line)" : "Write a message…"} maxLength={4000} rows={1}/><button className="send-button" disabled={!draft.trim() || sendBusy} aria-label="Send message"><Send size={18}/></button></form>
      </> : <div className="welcome-chat"><span className="welcome-icon"><MessageCircle size={32}/></span><h2>Your conversations, together.</h2><p>Choose a conversation or open Saved messages to keep notes to yourself.</p></div>}
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    </section>
  </main>;
}