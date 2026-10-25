import { useEffect, useRef, useState } from "react";
import { Search, Send, MessageCircle, Users, ArrowLeft, Bookmark, SquarePen, ChevronLeft, Trash2, X, Reply } from "lucide-react";
import { supabase } from "../lib/supabase";

function Avatar({ person, className = "" }) {
  const label = (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase();
  return <span className={`avatar ${className}`}>{person?.avatar_url ? <img src={person.avatar_url} alt=""/> : label}</span>;
}

export default function Chat({ session, profile, targetId, enterToSend = true, onBackToFeed, onOpenProfile }) {
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [drafts, setDrafts] = useState({});
  const [messageSearch, setMessageSearch] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [messageActionBusy, setMessageActionBusy] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [lastMessages, setLastMessages] = useState({});
  const [recentMessages, setRecentMessages] = useState([]);
  const [readMarkers, setReadMarkers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`chatly-read-markers-${session.user.id}`) || "{}"); }
    catch { return {}; }
  });
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);
  const activeIdRef = useRef(null);

  useEffect(() => {
    supabase.from("messages").select("id,sender_id,recipient_id,body,created_at").or("sender_id.eq." + session.user.id + ",recipient_id.eq." + session.user.id).order("created_at", { ascending: false }).limit(250)
      .then(({ data }) => {
        if (!data) return;
        setRecentMessages(data);
        const latest = {};
        data.forEach(message => { const peer = message.sender_id === session.user.id ? message.recipient_id : message.sender_id; if (!latest[peer]) latest[peer] = message; });
        setLastMessages(latest);
      });
  }, [session.user.id]);

  useEffect(() => {
    try { localStorage.setItem(`chatly-read-markers-${session.user.id}`, JSON.stringify(readMarkers)); }
    catch { /* Browser storage may be unavailable; unread tracking remains session-local. */ }
  }, [readMarkers, session.user.id]);

  useEffect(() => {
    if (!active) return;
    const latestIncoming = messages.filter(m => m.sender_id === active.id && m.recipient_id === session.user.id).reduce((latest, m) => !latest || m.created_at > latest ? m.created_at : latest, null);
    if (latestIncoming && (!readMarkers[active.id] || latestIncoming > readMarkers[active.id])) {
      setReadMarkers(current => ({ ...current, [active.id]: latestIncoming }));
    }
  }, [active, messages, session.user.id, readMarkers]);

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
      setHistoryBusy(true);
      setHasOlderMessages(false);
      const { data, error: err } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${session.user.id})`)
        .order("created_at", { ascending: false })
        .limit(60);
      if (alive) {
        if (err) setError(err.message);
        else {
          const page = (data || []).reverse();
          setMessages(page);
          setHasOlderMessages((data || []).length === 60);
        }
        setHistoryBusy(false);
      }
    };
    load();
    const channel = supabase.channel(`chat-${[session.user.id, active.id].sort().join("-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        if (!alive) return;
        const m = payload.new;
        const isThisConversation = (m.sender_id === session.user.id && m.recipient_id === active.id) || (m.sender_id === active.id && m.recipient_id === session.user.id);
        const peer = m.sender_id === session.user.id ? m.recipient_id : m.sender_id;
        setRecentMessages(current => current.some(item => item.id === m.id) ? current : [m, ...current].slice(0, 250));
        setLastMessages(current => {
          const previous = current[peer];
          return !previous || new Date(m.created_at) >= new Date(previous.created_at) ? { ...current, [peer]: m } : current;
        });
        if (isThisConversation) {
          setMessages(current => {
            if (current.some(item => item.id === m.id)) return current;
            return [...current, m].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, payload => {
        if (!alive) return;
        const removed = payload.old;
        const isThisConversation = (removed.sender_id === session.user.id && removed.recipient_id === active.id) || (removed.sender_id === active.id && removed.recipient_id === session.user.id);
        if (isThisConversation) setMessages(current => current.filter(item => item.id !== removed.id));
        setRecentMessages(current => current.filter(item => item.id !== removed.id));
        setLastMessages(current => {
          if (current[active.id]?.id !== removed.id) return current;
          const fallback = recentMessages.find(item => item.id !== removed.id && (item.sender_id === active.id || item.recipient_id === active.id));
          return { ...current, [active.id]: fallback || null };
        });
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [active, session.user.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" }); }, [messages]);

  async function loadOlderMessages() {
    if (!active || historyBusy || !hasOlderMessages || !messages.length) return;
    const oldest = messages[0];
    const list = messageListRef.current;
    const previousHeight = list?.scrollHeight || 0;
    setHistoryBusy(true);
    const { data, error: err } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${session.user.id})`)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(60);
    if (err) setError(err.message);
    else {
      const older = (data || []).reverse();
      setMessages(current => {
        const existing = new Set(current.map(message => message.id));
        return [...older.filter(message => !existing.has(message.id)), ...current];
      });
      setHasOlderMessages((data || []).length === 60);
      requestAnimationFrame(() => {
        if (list) list.scrollTop += list.scrollHeight - previousHeight;
      });
    }
    setHistoryBusy(false);
  }

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !active || sendBusy) return;

    const recipientId = active.id;
    const replyingTo = replyTo;
    const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: session.user.id,
      recipient_id: recipientId,
      body,
      reply_to: replyingTo?.id || null,
      created_at: new Date().toISOString(),
      _pending: true,
    };

    setSendBusy(true);
    setError("");
    setDraft("");
    setReplyTo(null);
    setMessages(current => current.some(m => m.id === optimisticId) ? current : [...current, optimisticMessage]);

    try {
      const { data, error: err } = await supabase.from("messages")
        .insert({ sender_id: session.user.id, recipient_id: recipientId, body, reply_to: replyingTo?.id || null })
        .select("*")
        .single();

      if (err) throw err;
      if (data) {
        setMessages(current => {
          const withoutPending = current.filter(m => m.id !== optimisticId && m.id !== data.id);
          return [...withoutPending, data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
        setRecentMessages(current => [data, ...current.filter(m => m.id !== data.id)].slice(0, 250));
        setLastMessages(current => ({ ...current, [recipientId]: data }));
      }
    } catch (err) {
      setMessages(current => current.filter(m => m.id !== optimisticId));
      if (active?.id === recipientId) {
        setDraft(current => current || body);
        setReplyTo(current => current || replyingTo);
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
  const unreadCounts = recentMessages.reduce((counts, message) => {
    if (message.sender_id === session.user.id) return counts;
    const peer = message.sender_id;
    if (message.recipient_id !== session.user.id || (readMarkers[peer] && message.created_at <= readMarkers[peer])) return counts;
    counts[peer] = (counts[peer] || 0) + 1;
    return counts;
  }, {});
  const visiblePeople = [self, ...people.filter(p => p.id !== session.user.id)]
    .filter(p => `${p.username || ""} ${p.display_name || ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(p => filter === "all" || (filter === "saved" && p.id === session.user.id) || (filter === "people" && p.id !== session.user.id) || (filter === "unread" && unreadCounts[p.id] > 0))
    .sort((a, b) => {
      if (a.id === session.user.id) return b.id === session.user.id ? 0 : -1;
      if (b.id === session.user.id) return 1;
      const aTime = lastMessages[a.id]?.created_at ? new Date(lastMessages[a.id].created_at).getTime() : 0;
      const bTime = lastMessages[b.id]?.created_at ? new Date(lastMessages[b.id].created_at).getTime() : 0;
      return bTime - aTime || (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
    });

  return <main className={`chat-layout ${active ? "has-active" : ""}`}>
    <aside className="sidebar">
      <div className="sidebar-heading"><div className="chat-heading-title"><button className="chat-feed-back" onClick={onBackToFeed} aria-label="Back to feed"><ChevronLeft size={20}/></button><MessageCircle size={20}/> <span>Chats</span></div><button className="chat-new-button" aria-label="New chat" onClick={() => { setFilter("all"); setQuery(""); setActive(null); }}><SquarePen size={18}/></button></div>
      <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chats…"/></div>
      <div className="chat-filter-row">{[["all","All"],["people","People"],["saved","Saved"],["unread","Unread"]].map(([key,label])=><button key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{label}{key === "unread" && Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0 ? ` · ${Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)}` : ""}</button>)}</div><div className="people-list">
        {visiblePeople.map(person => <button key={person.id} className={`person-row ${active?.id === person.id ? "selected" : ""}`} onClick={() => { setDrafts(current => ({ ...current, [active?.id || "__none"]: draft })); setDraft(drafts[person.id] || ""); setActive(person); setMessageSearch(""); setError(""); }}>
          <span className="chat-avatar-profile-link" role="button" tabIndex={0} aria-label={`View ${person.display_name || person.username || "member"} profile`} onClick={event => { event.stopPropagation(); onOpenProfile?.(person); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onOpenProfile?.(person); } }}><Avatar person={person}/></span>
          <span className="person-copy"><strong>{person.id === session.user.id ? "Saved messages" : person.display_name || person.username || "Chatly user"}</strong><small>{lastMessages[person.id] ? `${lastMessages[person.id].sender_id === session.user.id ? "You: " : ""}${lastMessages[person.id].body}` : person.id === session.user.id ? "Your personal space for notes" : person.username ? `@${person.username}` : "Chatly member"}</small></span>{unreadCounts[person.id] > 0 && <span className="chat-unread-count" aria-label={`${unreadCounts[person.id]} unread messages`}>{unreadCounts[person.id] > 99 ? "99+" : unreadCounts[person.id]}</span>}<time className="chat-row-time">{lastMessages[person.id] ? new Date(lastMessages[person.id].created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</time>
        </button>)}
        {!visiblePeople.length && <p className="empty-small">{query ? "No matches found." : "No conversations yet. Start a new chat!"}</p>}
      </div>
    </aside>
    <section className="conversation">
      {active ? <>
        <header className="conversation-header"><button className="conversation-close" onClick={() => { setDrafts(current => ({ ...current, [active.id]: draft })); setDraft(""); setActive(null); }} aria-label="Close conversation" title="Close conversation"><X size={18}/></button><span className="chat-avatar-profile-link" role="button" tabIndex={0} aria-label={`View ${active.display_name || active.username || "member"} profile`} onClick={() => onOpenProfile?.(active)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenProfile?.(active); } }}><Avatar person={active}/></span><div><strong>{active.id === session.user.id ? "Saved messages" : active.display_name || active.username || "Chatly user"}</strong><small>{active.id === session.user.id ? "Only you" : active.username ? `@${active.username}` : "Chatly member"}</small></div></header>
        <div className="message-list" ref={messageListRef}>
          {hasOlderMessages && <button type="button" className="load-older-messages" onClick={loadOlderMessages} disabled={historyBusy}>{historyBusy ? "Loading…" : "Load older messages"}</button>}
          {messages.filter(m => !messageSearch.trim() || m.body.toLowerCase().includes(messageSearch.trim().toLowerCase())).map(m => <div key={m.id} className={`message ${m.sender_id === session.user.id ? "mine" : "theirs"}`}><div className="bubble">{m.reply_to && <div className="message-reply-preview"><span>Replying to</span><p>{messages.find(item => item.id === m.reply_to)?.body || "Original message"}</p></div>}{m.body}<time>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><button type="button" className="message-reply" aria-label="Reply to message" title="Reply to message" onClick={() => { setReplyTo(m); document.querySelector(".composer textarea")?.focus(); }}><Reply size={13}/></button>{m.sender_id === session.user.id && <button type="button" className="message-delete" aria-label="Delete message" title="Delete message" disabled={messageActionBusy === m.id} onClick={() => deleteMessage(m)}><Trash2 size={13}/></button>}</div></div>)}
          {!messages.length && <div className="empty-chat"><MessageCircle size={32}/><p>{active.id === session.user.id ? "Save a note, link, or message for yourself." : `Say hello to ${active.display_name || active.username || "your new connection"}!`}</p></div>}
          <div ref={bottomRef}/>
        </div>
        <div className="chat-message-search"><Search size={15}/><input aria-label="Search messages in this chat" placeholder="Search in conversation" value={messageSearch} onChange={e => setMessageSearch(e.target.value)}/></div><form className="composer" onSubmit={sendMessage}>{replyTo && <div className="composer-reply-preview"><div><strong>Replying to {replyTo.sender_id === session.user.id ? "yourself" : (active.display_name || active.username || "user")}</strong><span>{replyTo.body}</span></div><button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={16}/></button></div>}<textarea aria-label="Message" value={draft} onChange={e => { setDraft(e.target.value); if (active) setDrafts(current => ({ ...current, [active.id]: e.target.value })); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && enterToSend) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={enterToSend ? "Write a message… (Shift+Enter for new line)" : "Write a message…"} maxLength={4000} rows={1}/><button className="send-button" disabled={!draft.trim() || sendBusy} aria-label="Send message"><Send size={18}/></button></form>
      </> : <div className="welcome-chat"><span className="welcome-icon"><MessageCircle size={32}/></span><h2>Your conversations, together.</h2><p>Choose a conversation or open Saved messages to keep notes to yourself.</p></div>}
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    </section>
  </main>;
}