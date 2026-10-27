import React, { useEffect, useRef, useState } from "react";
import { Search, Send, MessageCircle, Users, ArrowLeft, Bookmark, SquarePen, ChevronLeft, Trash2, X, Reply, Copy, Archive, Pin, Bell, BellOff, Pencil, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getStoredJSON, setStoredJSON } from "../lib/safeStorage.js";
import CreateGroupDialog from "./CreateGroupDialog";

function Avatar({ person, className = "" }) {
  const label = (person?.display_name || person?.username || "?").slice(0, 1).toUpperCase();
  return <span className={`avatar ${className}`}>{person?.avatar_url ? <img src={person.avatar_url} alt=""/> : label}</span>;
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMessageDateTime(value) {
  const date = new Date(value);
  return !value || Number.isNaN(date.getTime()) ? "Invalid message timestamp" : date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Chat({ session, profile, targetId, enterToSend = true, onBackToFeed, onOpenProfile }) {
  const [people, setPeople] = useState([]);
  const [groupConversations, setGroupConversations] = useState([]);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [drafts, setDrafts] = useState(() => getStoredJSON(`chatly-message-drafts-${session.user.id}`, {}));
  const [historyBusy, setHistoryBusy] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [messageActionBusy, setMessageActionBusy] = useState(null);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const [realtimeRetry, setRealtimeRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [archivedChats, setArchivedChats] = useState(() => getStoredJSON(`chatly-archived-chats-${session.user.id}`, []));
  const [pinnedChats, setPinnedChats] = useState(() => getStoredJSON(`chatly-pinned-chats-${session.user.id}`, []));
  const [mutedChats, setMutedChats] = useState(() => getStoredJSON(`chatly-muted-chats-${session.user.id}`, []));
  const [lastMessages, setLastMessages] = useState({});
  const [recentMessages, setRecentMessages] = useState([]);
  const [readMarkers, setReadMarkers] = useState(() => getStoredJSON(`chatly-read-markers-${session.user.id}`, {}));
  useEffect(() => { setStoredJSON(`chatly-message-drafts-${session.user.id}`, drafts); }, [drafts, session.user.id]);

  const bottomRef = useRef(null);
  const messageListRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const activeIdRef = useRef(null);

  useEffect(() => {
    let alive = true;
    supabase.from("messages").select("id,sender_id,recipient_id,body,created_at,read_at").or("sender_id.eq." + session.user.id + ",recipient_id.eq." + session.user.id).order("created_at", { ascending: false }).limit(250)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          setError(err.message || "Could not load conversations.");
          return;
        }
        const rows = data || [];
        setRecentMessages(rows);
        const latest = {};
        rows.forEach(message => { const peer = message.sender_id === session.user.id ? message.recipient_id : message.sender_id; if (!latest[peer]) latest[peer] = message; });
        setLastMessages(latest);
      });
    return () => { alive = false; };
  }, [session.user.id]);


  // Keep the conversation list and unread counts live even when no chat is open.
  useEffect(() => {
    let alive = true;
    const syncConversationList = async () => {
      const { data, error: syncError } = await supabase.from("messages")
        .select("id,sender_id,recipient_id,body,created_at,read_at,delivered_at,reply_to")
        .or("sender_id.eq." + session.user.id + ",recipient_id.eq." + session.user.id)
        .order("created_at", { ascending: false }).limit(250);
      if (!alive || syncError) {
        if (alive && syncError) setError(syncError.message || "Could not refresh conversations.");
        return;
      }
      const rows = data || [];
      setRecentMessages(rows);
      const latest = {};
      rows.forEach(message => {
        const peer = message.sender_id === session.user.id ? message.recipient_id : message.sender_id;
        if (peer && !latest[peer]) latest[peer] = message;
      });
      setLastMessages(latest);
    };

    const channel = supabase.channel(`account-messages-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${session.user.id}` }, payload => {
        if (!alive) return;
        const changed = payload.new || payload.old;
        const peer = changed.sender_id === session.user.id ? changed.recipient_id : changed.sender_id;
        if (payload.eventType === "INSERT") {
          setRecentMessages(current => [payload.new, ...current.filter(item => item.id !== payload.new.id)].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 250));
          setLastMessages(current => {
            const prior = current[peer];
            return !prior || new Date(payload.new.created_at) >= new Date(prior.created_at) ? { ...current, [peer]: payload.new } : current;
          });
        } else if (payload.eventType === "UPDATE") {
          setRecentMessages(current => current.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item));
          setLastMessages(current => Object.fromEntries(Object.entries(current).map(([id, item]) => [id, item?.id === payload.new.id ? { ...item, ...payload.new } : item])));
        } else if (payload.eventType === "DELETE") {
          setRecentMessages(current => current.filter(item => item.id !== payload.old.id));
          syncConversationList();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${session.user.id}` }, payload => {
        if (!alive) return;
        if (payload.eventType === "INSERT") {
          const incoming = payload.new;
          const peer = incoming.sender_id;
          setRecentMessages(current => [incoming, ...current.filter(item => item.id !== incoming.id)].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 250));
          setLastMessages(current => {
            const prior = current[peer];
            return !prior || new Date(incoming.created_at) >= new Date(prior.created_at) ? { ...current, [peer]: incoming } : current;
          });
        } else if (payload.eventType === "UPDATE") {
          const updated = payload.new;
          setRecentMessages(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item));
          setLastMessages(current => Object.fromEntries(Object.entries(current).map(([id, item]) => [id, item?.id === updated.id ? { ...item, ...updated } : item])));
        } else if (payload.eventType === "DELETE") {
          setRecentMessages(current => current.filter(item => item.id !== payload.old.id));
          syncConversationList();
        }
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") syncConversationList();
      });

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session.user.id]);

  useEffect(() => { setStoredJSON(`chatly-archived-chats-${session.user.id}`, archivedChats); }, [archivedChats, session.user.id]);
  useEffect(() => { setStoredJSON(`chatly-pinned-chats-${session.user.id}`, pinnedChats); }, [pinnedChats, session.user.id]);
  useEffect(() => { setStoredJSON(`chatly-muted-chats-${session.user.id}`, mutedChats); }, [mutedChats, session.user.id]);

  useEffect(() => {
    setStoredJSON(`chatly-read-markers-${session.user.id}`, readMarkers);
  }, [readMarkers, session.user.id]);

  useEffect(() => {
    if (!active) return;
    const latestIncoming = messages.filter(m => m.sender_id === active.id && m.recipient_id === session.user.id).reduce((latest, m) => !latest || m.created_at > latest ? m.created_at : latest, null);
    if (latestIncoming && (!readMarkers[active.id] || latestIncoming > readMarkers[active.id])) {
      setReadMarkers(current => ({ ...current, [active.id]: latestIncoming }));
    }
  }, [active, messages, session.user.id, readMarkers]);

  useEffect(() => {
    if (!active) return;
    const unreadIncoming = messages.filter(message =>
      message.sender_id === active.id && message.recipient_id === session.user.id && !message.read_at
    );
    if (!unreadIncoming.length) return;
    // Optimistic messages use string IDs such as "pending-...". The RPC accepts
    // only persisted messages whose IDs are numeric PostgreSQL bigint values.
    const ids = unreadIncoming
      .map(message => message.id)
      .filter(id => typeof id === "number" || (typeof id === "string" && /^\\d+$/.test(id)));
    if (!ids.length) return;

    const readAt = new Date().toISOString();
    setMessages(current => current.map(message => ids.includes(message.id) ? { ...message, read_at: readAt } : message));
    Promise.all(ids.map(id => supabase.rpc("mark_message_read", { p_message_id: Number(id) })))
      .then(results => {
        const failed = results.find(({ error: err }) => err);
        if (failed?.error) setError(failed.error.message || "Could not update read receipts.");
      });
  }, [active, messages, session.user.id]);

  useEffect(() => {
    supabase.from("profiles").select("id, username, display_name, avatar_url")
      .order("display_name")
      .then(({ data, error: err }) => { if (err) setError(err.message); else setPeople(data || []); });
  }, [session.user.id, profile]);

  useEffect(() => {
    let alive = true;
    const loadGroups = async () => {
      const { data: memberships, error: membershipError } = await supabase.from("group_conversation_members").select("conversation_id").eq("user_id", session.user.id);
      if (!alive) return;
      if (membershipError) {
        if (!/does not exist|schema cache|relation/i.test(membershipError.message || "")) setError(membershipError.message || "Could not load groups.");
        return;
      }
      const ids = (memberships || []).map(row => row.conversation_id).filter(Boolean);
      if (!ids.length) { setGroupConversations([]); return; }
      const { data, error: groupError } = await supabase.from("group_conversations").select("id,name,description,avatar_url,created_at,updated_at").in("id", ids).order("updated_at", { ascending: false });
      if (!alive) return;
      if (groupError) setError(groupError.message || "Could not load groups.");
      else setGroupConversations(data || []);
    };
    loadGroups();
    const channel = supabase.channel(`group-list-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_conversation_members", filter: `user_id=eq.${session.user.id}` }, loadGroups)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_conversations" }, loadGroups)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [session.user.id]);

  useEffect(() => {
    if (targetId) {
      const target = people.find(person => person.id === targetId) || (targetId === session.user.id ? profile : null);
      if (target) setActive(target);
    }
  }, [targetId, people, profile, session.user.id]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    if (active.type === "group") {
      let groupAlive = true;
      setHistoryBusy(true);
      const loadGroup = async () => {
        const { data, error: groupError } = await supabase.from("group_messages").select("*").eq("conversation_id", active.id).order("created_at", { ascending: false }).limit(60);
        if (!groupAlive) return;
        if (groupError) setError(groupError.message);
        else { setMessages((data || []).reverse()); setHasOlderMessages((data || []).length === 60); }
        setHistoryBusy(false);
      };
      loadGroup();
      const groupChannel = supabase.channel("group-feed-" + active.id).on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: "conversation_id=eq." + active.id }, payload => {
        if (!groupAlive) return;
        if (payload.eventType === "INSERT") setMessages(current => current.some(m => m.id === payload.new.id) ? current : [...current, payload.new].sort((a,b) => new Date(a.created_at)-new Date(b.created_at)));
        if (payload.eventType === "UPDATE") setMessages(current => current.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        if (payload.eventType === "DELETE") setMessages(current => current.filter(m => m.id !== payload.old.id));
      }).subscribe();
      return () => { groupAlive = false; supabase.removeChannel(groupChannel); };
    }
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, payload => {
        if (!alive) return;
        const updated = payload.new;
        const belongsToConversation = (updated.sender_id === session.user.id && updated.recipient_id === active.id) || (updated.sender_id === active.id && updated.recipient_id === session.user.id);
        if (belongsToConversation) setMessages(current => current.map(message => message.id === updated.id ? { ...message, ...updated } : message));
        setRecentMessages(current => current.map(message => message.id === updated.id ? { ...message, ...updated } : message));
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
      }).subscribe(status => {
        if (!alive) return;
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("reconnecting");
        else if (status === "CLOSED") setRealtimeStatus("disconnected");
      });
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [active, session.user.id, realtimeRetry]);

  useEffect(() => {
    if (!active) return;
    const handleConversationKeys = event => {
      if (event.key !== "Escape") return;
      if (editingMessageId) { cancelEdit(); return; }
      if (replyTo) { setReplyTo(null); return; }
      setDrafts(current => ({ ...current, [activeDraftKey]: draft }));
      setDraft("");
      setActive(null);
    };
    window.addEventListener("keydown", handleConversationKeys);
    return () => window.removeEventListener("keydown", handleConversationKeys);
  }, [active, draft, editingMessageId, replyTo]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  async function loadOlderMessages() {
    if (!active || historyBusy || !hasOlderMessages || !messages.length) return;
    const oldest = messages[0];
    const list = messageListRef.current;
    const previousHeight = list?.scrollHeight || 0;
    setHistoryBusy(true);
    const { data, error: err } = active.type === "group"
      ? await supabase.from("group_messages").select("*").eq("conversation_id", active.id).lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(60)
      : await supabase.from("messages").select("*").or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${session.user.id})`).lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(60);
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
      const { data, error: err } = active?.type === "group"
        ? await supabase.from("group_messages").insert({ conversation_id: recipientId, sender_id: session.user.id, body, reply_to: replyingTo?.id || null }).select("*").single()
        : await supabase.from("messages").insert({ sender_id: session.user.id, recipient_id: recipientId, body, reply_to: replyingTo?.id || null }).select("*").single();

      if (err) throw err;
      if (data) {
        setMessages(current => {
          const withoutPending = current.filter(m => m.id !== optimisticId && m.id !== data.id);
          return [...withoutPending, data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
        if (active?.type !== "group") {
          setRecentMessages(current => [data, ...current.filter(m => m.id !== data.id)].slice(0, 250));
          setLastMessages(current => ({ ...current, [recipientId]: data }));
        } else {
          setGroupConversations(current => current.map(group => group.id === recipientId ? { ...group, updated_at: data.created_at } : group));
        }
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

  function beginEdit(message) {
    if (message.sender_id !== session.user.id || message._pending) return;
    setEditingMessageId(message.id);
    setEditDraft(message.body);
    setError("");
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditDraft("");
  }

  async function saveEdit(message) {
    const body = editDraft.trim();
    if (!body) return;
    if (body === message.body) { cancelEdit(); return; }
    if (messageActionBusy) return;
    setMessageActionBusy(message.id);
    setError("");
    const { data, error: updateError } = active?.type === "group"
      ? await supabase.from("group_messages").update({ body, edited_at: new Date().toISOString() }).eq("id", message.id).eq("sender_id", session.user.id).select("*").single()
      : await supabase.from("messages").update({ body }).eq("id", message.id).eq("sender_id", session.user.id).select("*").single();
    if (updateError) setError(updateError.message || "Could not edit message.");
    else {
      setMessages(current => current.map(item => item.id === message.id ? { ...item, ...data } : item));
      setRecentMessages(current => current.map(item => item.id === message.id ? { ...item, ...data } : item));
      setLastMessages(current => Object.fromEntries(Object.entries(current).map(([peer, item]) => [peer, item?.id === message.id ? { ...item, ...data } : item])));
      cancelEdit();
    }
    setMessageActionBusy(null);
  }

  async function deleteMessage(message) {
    if (message.sender_id !== session.user.id || messageActionBusy) return;
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    setMessageActionBusy(message.id);
    setError("");
    setActionNotice("");
    const { error: deleteError } = active?.type === "group"
      ? await supabase.from("group_messages").delete().eq("id", message.id).eq("sender_id", session.user.id)
      : await supabase.from("messages").delete().eq("id", message.id).eq("sender_id", session.user.id);
    if (deleteError) {
      setError(deleteError.message || "Could not delete message. Please try again.");
    } else {
      setMessages(current => current.filter(item => item.id !== message.id));
      setRecentMessages(current => current.filter(item => item.id !== message.id));
      setLastMessages(current => Object.fromEntries(Object.entries(current).map(([peer, item]) => [peer, item?.id === message.id ? null : item])));
      setActionNotice("Message deleted.");
    }
    setMessageActionBusy(null);
  }

  const activeDraftKey = active?.type === "group" ? `group:${active.id}` : active?.id;
  const self = { ...(profile || {}), id: session.user.id, display_name: "Saved messages", username: "You", avatar_url: profile?.avatar_url };
  // The database receipt is authoritative. Local "last opened" markers can
  // hide messages that are still unseen on this account (especially across devices).
  const unreadCounts = recentMessages.reduce((counts, message) => {
    if (
      message.sender_id === session.user.id ||
      message.recipient_id !== session.user.id ||
      message.read_at ||
      message.sender_id === active?.id
    ) return counts;
    const peer = message.sender_id;
    counts[peer] = (counts[peer] || 0) + 1;
    return counts;
  }, {});
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = groupConversations.filter(group => {
    const searchable = `${group.name || ""} ${group.description || ""}`.toLocaleLowerCase();
    const key = `group:${group.id}`;
    return (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (filter === "archived" ? archivedChats.includes(key) :
        !archivedChats.includes(key) && !["saved", "people", "unread"].includes(filter));
  }).sort((a, b) => {
    const aPinned = pinnedChats.includes(`group:${a.id}`);
    const bPinned = pinnedChats.includes(`group:${b.id}`);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  });

  // Only list users with an existing message relationship; do not expose every registered profile in Chats.
  const contactedUserIds = new Set(recentMessages.map(message => message.sender_id === session.user.id ? message.recipient_id : message.sender_id));
  const visiblePeople = [self, ...people.filter(p => p.id !== session.user.id && contactedUserIds.has(p.id))]
    .filter(person => {
      const latestBody = lastMessages[person.id]?.body || "";
      const searchable = `${person.username || ""} ${person.display_name || ""} ${latestBody}`.toLocaleLowerCase();
      return !normalizedQuery || searchable.includes(normalizedQuery);
    })
    .filter(person => filter === "archived"
      ? archivedChats.includes(person.id)
      : !archivedChats.includes(person.id) && (filter === "all" || (filter === "saved" && person.id === session.user.id) || (filter === "people" && person.id !== session.user.id) || (filter === "unread" && unreadCounts[person.id] > 0)))
    .sort((a, b) => {
      if (a.id === session.user.id) return b.id === session.user.id ? 0 : -1;
      if (b.id === session.user.id) return 1;
      const aPinned = pinnedChats.includes(a.id);
      const bPinned = pinnedChats.includes(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      const aTime = lastMessages[a.id]?.created_at ? new Date(lastMessages[a.id].created_at).getTime() : 0;
      const bTime = lastMessages[b.id]?.created_at ? new Date(lastMessages[b.id].created_at).getTime() : 0;
      return bTime - aTime || (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "");
    });

  return <><main className={`chat-layout ${active ? "has-active" : ""}`}>
    <aside className="sidebar">
      <div className="sidebar-heading"><div className="chat-heading-title"><button className="chat-feed-back" onClick={onBackToFeed} aria-label="Back to feed"><ChevronLeft size={20}/></button><MessageCircle size={20}/> <span>Chats</span></div><button className="chat-new-button" aria-label="New chat" onClick={() => { setFilter("all"); setQuery(""); setActive(null); setShowGroupCreate(true); }}><SquarePen size={18}/></button></div>
      <div className="search-box"><Search size={17}/><input aria-label="Search conversations by name, username, or latest message" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chats…"/>{query && <button type="button" className="chat-search-clear" aria-label="Clear chat search" title="Clear search" onClick={() => setQuery("")}><X size={15}/></button>}</div>
      <div className="chat-filter-row">{[["all","All"],["people","People"],["saved","Saved"],["unread","Unread"],["archived","Archived"]].map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{label}{key === "unread" && Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0 ? ` · ${Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)}` : ""}</button>)}</div><div className="people-list">        {visibleGroups.map(group => <button key={`group:${group.id}`} type="button" aria-current={active?.type === "group" && active.id === group.id ? "true" : undefined} className={`person-row ${active?.type === "group" && active.id === group.id ? "selected" : ""}`} onClick={() => { setDrafts(current => ({ ...current, [activeDraftKey || "__none"]: draft })); setDraft(drafts[`group:${group.id}`] || ""); setActive({ ...group, type: "group", display_name: group.name, username: "", avatar_url: group.avatar_url }); setError(""); }}>          <span className="chat-avatar-profile-link"><Avatar person={{ display_name: group.name, avatar_url: group.avatar_url }}/></span>          <span className="person-copy"><strong>{pinnedChats.includes(`group:${group.id}`) && <Pin size={12} aria-label="Pinned"/>} {mutedChats.includes(`group:${group.id}`) && <BellOff size={12} aria-label="Muted"/>} <Users size={13}/> {group.name}</strong><small>{group.description || "Group conversation"}</small></span><time className="chat-row-time">{new Date(group.updated_at || group.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</time>        </button>)}
        {visiblePeople.map(person => <button key={person.id} type="button" aria-current={active?.id === person.id ? "true" : undefined} className={`person-row ${active?.id === person.id ? "selected" : ""}`} onClick={() => { setDrafts(current => ({ ...current, [activeDraftKey || "__none"]: draft })); setDraft(drafts[person.id] || ""); setActive(person); setError(""); }}>
          <span className="chat-avatar-profile-link" role="button" tabIndex={0} aria-label={`View ${person.display_name || person.username || "member"} profile`} onClick={event => { event.stopPropagation(); onOpenProfile?.(person); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onOpenProfile?.(person); } }}><Avatar person={person}/></span>
          <span className="person-copy"><strong>{pinnedChats.includes(person.id) && <Pin size={12} aria-label="Pinned"/>} {mutedChats.includes(person.id) && <BellOff size={12} aria-label="Muted"/>} {person.id === session.user.id ? "Saved messages" : person.display_name || person.username || "Chatly user"}</strong><small>{lastMessages[person.id] ? `${lastMessages[person.id].sender_id === session.user.id ? "You: " : ""}${lastMessages[person.id].body}` : person.id === session.user.id ? "Your personal space for notes" : person.username ? `@${person.username}` : "Chatly member"}</small></span>{unreadCounts[person.id] > 0 && <span className="chat-unread-count" aria-label={`${unreadCounts[person.id]} unread messages`}>{unreadCounts[person.id] > 99 ? "99+" : unreadCounts[person.id]}</span>}<time className="chat-row-time">{lastMessages[person.id] ? new Date(lastMessages[person.id].created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</time>
        </button>)}
        {!visiblePeople.length && <div className="empty-small chat-search-empty" role="status"><p>{query ? "No conversations match your search." : filter === "unread" ? "You’re all caught up." : filter === "saved" ? "Saved messages are always available here." : filter === "archived" ? "No archived conversations." : filter === "people" ? "No people to show yet." : "No conversations yet. Start a new chat!"}</p>{query && <button type="button" onClick={() => setQuery("")}>Clear search</button>}</div>}
      </div>
    </aside>
    <section className="conversation">
      {active ? <>
        <header className="conversation-header"><button type="button" className="conversation-mute" aria-label={mutedChats.includes(active.id) ? "Unmute conversation" : "Mute conversation"} title={mutedChats.includes(active.id) ? "Unmute conversation" : "Mute conversation"} onClick={() => setMutedChats(current => current.includes(active.id) ? current.filter(id => id !== active.id) : [...current, active.id])}>{mutedChats.includes(active.id) ? <BellOff size={17}/> : <Bell size={17}/>}</button><button type="button" className="conversation-pin" aria-label={pinnedChats.includes(active.id) ? "Unpin conversation" : "Pin conversation"} title={pinnedChats.includes(active.id) ? "Unpin conversation" : "Pin conversation"} onClick={() => setPinnedChats(current => current.includes(active.id) ? current.filter(id => id !== active.id) : [...current, active.id])}><Pin size={17}/></button><button type="button" className="conversation-archive" aria-label={archivedChats.includes(active.id) ? "Unarchive conversation" : "Archive conversation"} title={archivedChats.includes(active.id) ? "Unarchive conversation" : "Archive conversation"} onClick={() => { setArchivedChats(current => current.includes(active.id) ? current.filter(id => id !== active.id) : [...current, active.id]); setDrafts(current => ({ ...current, [activeDraftKey]: draft })); setDraft(""); setActive(null); }}><Archive size={17}/></button><button className="conversation-close" onClick={() => { setDrafts(current => ({ ...current, [activeDraftKey]: draft })); setDraft(""); setActive(null); }} aria-label="Back to conversations" title="Back to conversations"><ArrowLeft size={18}/></button><span className={active.type === "group" ? "chat-avatar-profile-link group-header-avatar" : "chat-avatar-profile-link"} role={active.type === "group" ? undefined : "button"} tabIndex={active.type === "group" ? undefined : 0} aria-label={active.type === "group" ? active.name || active.display_name || "Group conversation" : `View ${active.display_name || active.username || "member"} profile`} onClick={active.type === "group" ? undefined : () => onOpenProfile?.(active)} onKeyDown={active.type === "group" ? undefined : event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenProfile?.(active); } }}><Avatar person={active}/></span><div className="conversation-title-copy"><strong>{active.id === session.user.id ? "Saved messages" : active.type === "group" ? active.name || active.display_name || "Group conversation" : active.display_name || active.username || "Chatly user"}</strong><small>{active.id === session.user.id ? "Only you" : active.type === "group" ? "Group conversation" : active.username ? `@${active.username}` : "Chatly member"}</small></div></header>
        <div className="message-list" ref={messageListRef} onScroll={() => { const list = messageListRef.current; if (list) shouldAutoScrollRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120; }}>
          {realtimeStatus !== "connected" && <div className="chat-realtime-status" role="status"><span>{realtimeStatus === "connecting" ? "Connecting to live updates…" : realtimeStatus === "reconnecting" ? "Connection interrupted. Reconnecting to live updates…" : "Live updates disconnected. Messages may be delayed."}</span><button type="button" onClick={() => { setRealtimeStatus("connecting"); setRealtimeRetry(value => value + 1); }} disabled={realtimeStatus === "connecting"} aria-label="Retry live connection">{realtimeStatus === "connecting" ? "Connecting…" : "Retry"}</button></div>}
          {hasOlderMessages && <button type="button" className="load-older-messages" onClick={loadOlderMessages} disabled={historyBusy}>{historyBusy ? "Loading…" : "Load older messages"}</button>}
          {messages.map((m, index, filteredMessages) => {
            const previous = filteredMessages[index - 1];
            const currentDate = new Date(m.created_at);
            const previousDate = previous ? new Date(previous.created_at) : null;
            const validDate = !Number.isNaN(currentDate.getTime());
            const startsNewDay = validDate && (!previousDate || Number.isNaN(previousDate.getTime()) || currentDate.toDateString() !== previousDate.toDateString());
            return <React.Fragment key={m.id}>{startsNewDay && <div className="message-date-separator" role="separator"><span>{currentDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: currentDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}</span></div>}<div id={`message-${m.id}`} className={`message ${m.sender_id === session.user.id ? "mine" : "theirs"}`}><div className="bubble">{active?.type === "group" && m.sender_id !== session.user.id && <span className="group-message-sender">{people.find(person => person.id === m.sender_id)?.display_name || people.find(person => person.id === m.sender_id)?.username || "Chatly member"}</span>}{m.reply_to && <button type="button" className="message-reply-preview" aria-label={`Replying to ${(() => { const original = messages.find(item => item.id === m.reply_to); const author = original?.sender_id === session.user.id ? profile : people.find(person => person.id === original?.sender_id); return author?.display_name || author?.username || (original?.sender_id === session.user.id ? "You" : active?.display_name || active?.username || "member"); })()}`} title="Jump to replied message" onClick={() => { const original = document.getElementById(`message-${m.reply_to}`); if (original) { original.scrollIntoView({ behavior: "smooth", block: "center" }); original.classList.add("message-reply-target"); window.setTimeout(() => original.classList.remove("message-reply-target"), 1400); } else { setError("That original message is not loaded in this conversation."); } }}>{(() => { const original = messages.find(item => item.id === m.reply_to); const author = original?.sender_id === session.user.id ? profile : people.find(person => person.id === original?.sender_id); const authorName = author?.display_name || author?.username || (original?.sender_id === session.user.id ? "You" : active?.display_name || active?.username || "member"); return <><span>Replying to {authorName}</span><p>{original?.body || "Original message"}</p></>; })()}</button>}{editingMessageId === m.id ? <div className="message-edit-form"><textarea aria-label="Edit message" value={editDraft} maxLength={4000} onChange={event => setEditDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); saveEdit(m); } if (event.key === "Escape") cancelEdit(); }}/><div><button type="button" onClick={cancelEdit}>Cancel</button><button type="button" disabled={!editDraft.trim() || messageActionBusy === m.id} onClick={() => saveEdit(m)}><Check size={13}/> Save</button></div></div> : <>{m.body}{m.edited_at && <span className="message-edited-label" title={formatMessageDateTime(m.edited_at)}> (edited)</span>}</>}<time dateTime={m.created_at} title={formatMessageDateTime(m.created_at)}>{formatMessageTime(m.created_at)}{m.sender_id === session.user.id && m.read_at && <span className="message-read-receipt" title="Seen"> · Seen</span>}{m.sender_id === session.user.id && !m.read_at && m.delivered_at && <span className="message-delivery-status" title="Unseen"> · Unseen</span>}{m.sender_id === session.user.id && m._pending && <span className="message-delivery-status" title="Sending"> · Sending</span>}</time><button type="button" className="message-copy" aria-label="Copy message" title="Copy message" onClick={async () => { try { await navigator.clipboard.writeText(m.body); } catch { setError("Could not copy message. Check clipboard permissions."); } }}><Copy size={13}/></button><button type="button" className="message-reply" aria-label="Reply to message" title="Reply to message" onClick={() => { setReplyTo(m); document.querySelector(".composer textarea")?.focus(); }}><Reply size={13}/></button>{m.sender_id === session.user.id && !m._pending && editingMessageId !== m.id && <button type="button" className="message-edit" aria-label="Edit message" title="Edit message" disabled={messageActionBusy === m.id} onClick={() => beginEdit(m)}><Pencil size={13}/></button>}{m.sender_id === session.user.id && <button type="button" className="message-delete" aria-label="Delete message" title="Delete message" disabled={messageActionBusy === m.id} onClick={() => deleteMessage(m)}><Trash2 size={13}/></button>}</div></div></React.Fragment>;
          })}
          {historyBusy && !messages.length && <div className="chat-history-skeleton" role="status" aria-label="Loading messages"><span className="chat-skeleton-date" /><div className="chat-skeleton-row incoming"><span className="chat-skeleton-bubble short" /></div><div className="chat-skeleton-row outgoing"><span className="chat-skeleton-bubble medium" /></div><div className="chat-skeleton-row incoming"><span className="chat-skeleton-bubble long" /></div><div className="chat-skeleton-row outgoing"><span className="chat-skeleton-bubble short" /></div><span className="chat-skeleton-live">Loading conversation…</span></div>}
          {!historyBusy && !messages.length && <div className="empty-chat"><span className="empty-chat-icon"><MessageCircle size={32}/></span><h3>{active.id === session.user.id ? "Your private space" : "Start a conversation"}</h3><p>{active.id === session.user.id ? "Keep notes, links, and messages here. Only you can see them." : "Send the first message to get the conversation going."}</p><button type="button" className="empty-chat-start" onClick={() => document.querySelector(".composer textarea")?.focus()}>{active.id === session.user.id ? "Write a note" : "Write a message"}</button></div>}
          <div ref={bottomRef}/>
        </div>
<form className="composer" onSubmit={sendMessage}>{replyTo && <div className="composer-reply-preview"><div><strong>Replying to {replyTo.sender_id === session.user.id ? "yourself" : (active.display_name || active.username || "user")}</strong><span>{replyTo.body}</span></div><button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={16}/></button></div>}<textarea aria-label="Message" value={draft} onChange={e => { setDraft(e.target.value); if (active) setDrafts(current => ({ ...current, [activeDraftKey]: e.target.value })); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && enterToSend) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="Write a message…" maxLength={4000} rows={1}/><button className="send-button" disabled={!draft.trim() || sendBusy} aria-label="Send message"><Send size={18}/></button></form>
      </> : <div className="welcome-chat"><span className="welcome-icon"><MessageCircle size={32}/></span><h2>Your conversations, together.</h2><p>Choose a conversation or open Saved messages to keep notes to yourself.</p></div>}
      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}{actionNotice && <div className="chat-action-notice" role="status">{actionNotice}<button type="button" aria-label="Dismiss notification" onClick={() => setActionNotice("")}><X size={14}/></button></div>}
    </section>
  </main>{showGroupCreate && <CreateGroupDialog session={session} people={people} onClose={() => setShowGroupCreate(false)} onCreated={group => { setGroupConversations(current => [group, ...current.filter(item => item.id !== group.id)]); setActive({ ...group, type: "group", display_name: group.name }); setActionNotice(group?.avatar_upload_warning || "Group created."); setShowGroupCreate(false); }}/>}</>;
}