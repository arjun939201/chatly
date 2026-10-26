import React, { useMemo, useState } from "react";
import { X, Users, Search, Check, LoaderCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function CreateGroupDialog({ session, people = [], onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const candidates = useMemo(() => people.filter(person =>
    person.id !== session.user.id &&
    `${person.display_name || ""} ${person.username || ""}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [people, query, session.user.id]);

  function toggleMember(id) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  async function createGroup(event) {
    event.preventDefault();
    const groupName = name.trim();
    if (groupName.length < 2) { setError("Enter a group name with at least 2 characters."); return; }
    if (!selected.length) { setError("Select at least one person to create a group."); return; }
    setBusy(true);
    setError("");
    try {
      // Resolve the user from the active Supabase auth token. The RLS policy checks
      // created_by against auth.uid(), so a potentially stale session prop is not enough.
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser?.id) throw new Error("Your session has expired. Please sign in again.");
      if (session?.user?.id && session.user.id !== authUser.id) {
        throw new Error("Your session changed. Refresh Chatly and try creating the group again.");
      }

      // Create the group and invitees atomically through a narrowly scoped database RPC.
      // This avoids client-side INSERT RLS/RETURNING policy mismatches.
      const { data: groupId, error: groupError } = await supabase.rpc("create_group_conversation", {
        p_name: groupName,
        p_description: description.trim(),
        p_member_ids: selected,
      });
      if (groupError) throw groupError;
      if (!groupId) throw new Error("The group was not created. Please try again.");

      const { data: group, error: loadGroupError } = await supabase.from("group_conversations")
        .select("*").eq("id", groupId).single();
      if (loadGroupError) throw loadGroupError;
      onCreated?.(group);
      onClose?.();
    } catch (err) {
      console.error("Group creation failed:", err);
      setError(err?.message || "Could not create this group. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="group-create-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
    <section className="group-create-dialog" role="dialog" aria-modal="true" aria-labelledby="group-create-title">
      <header><span className="group-create-icon"><Users size={20}/></span><div><h2 id="group-create-title">Create a group</h2><p>Start a conversation with multiple people.</p></div><button type="button" aria-label="Close" onClick={onClose} disabled={busy}><X size={18}/></button></header>
      <form onSubmit={createGroup}>
        <label>Group name<input autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Weekend plans" /></label>
        <label>Description <span>(optional)</span><textarea maxLength={500} rows={2} value={description} onChange={event => setDescription(event.target.value)} placeholder="What is this group for?" /></label>
        <div className="group-member-picker"><div className="group-member-picker-title"><strong>Add people</strong><span>{selected.length} selected</span></div><div className="group-member-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people…" /></div>
          <div className="group-member-options">{candidates.map(person => <button key={person.id} type="button" className={selected.includes(person.id) ? "selected" : ""} onClick={() => toggleMember(person.id)}><span className="group-member-avatar">{person.avatar_url ? <img src={person.avatar_url} alt="" /> : (person.display_name || person.username || "?").slice(0,1).toUpperCase()}</span><span><strong>{person.display_name || person.username || "Chatly user"}</strong><small>{person.username ? `@${person.username}` : "Chatly member"}</small></span><span className="group-member-check">{selected.includes(person.id) ? <Check size={16}/> : null}</span></button>)}
          {!candidates.length && <p className="group-picker-empty">No matching people found.</p>}</div>
        </div>
        {error && <p className="group-create-error" role="alert">{error}</p>}
        <footer><button type="button" className="group-cancel" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="group-submit" disabled={busy || !name.trim() || !selected.length}>{busy ? <><LoaderCircle size={16} className="spin"/> Creating…</> : "Create group"}</button></footer>
      </form>
    </section>
  </div>;
}
