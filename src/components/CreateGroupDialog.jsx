import React, { useEffect, useMemo, useState } from "react";
import { X, Users, Search, Check, LoaderCircle, UserRound, Trash2, ImagePlus } from "lucide-react";
import { supabase } from "../lib/supabase";

const displayName = person => person.display_name?.trim() || person.username?.trim() || "Chatly user";
const initials = person => displayName(person).slice(0, 1).toUpperCase();

export default function CreateGroupDialog({ session, people = [], onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");\n  const [avatarFile, setAvatarFile] = useState(null);\n  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    function handleDialogKeyDown(event) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose?.();
      }
    }
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [busy, onClose]);

  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  const eligiblePeople = useMemo(() => {
    const seen = new Set();
    return people.filter(person => {
      if (!person?.id || person.id === session?.user?.id || seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    }).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [people, session?.user?.id]);

  useEffect(() => {
    const availableIds = new Set(eligiblePeople.map(person => person.id));
    setSelected(current => current.filter(id => availableIds.has(id)));
  }, [eligiblePeople]);

  const selectedPeople = useMemo(
    () => selected.map(id => eligiblePeople.find(person => person.id === id)).filter(Boolean),
    [eligiblePeople, selected]
  );
  const candidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return eligiblePeople.filter(person =>
      !normalized || [person.display_name, person.username].filter(Boolean)
        .some(value => value.toLocaleLowerCase().includes(normalized))
    );
  }, [eligiblePeople, query]);

  function toggleMember(id) {
    setError("");
    setSelected(current => current.includes(id)
      ? current.filter(value => value !== id)
      : [...current, id]);
  }

  function clearMembers() {
    setSelected([]);
    setError("");
  }

  async function createGroup(event) {
    event.preventDefault();
    const groupName = name.trim();
    const memberIds = [...new Set(selected)].filter(id => eligiblePeople.some(person => person.id === id));
    if (groupName.length < 2) { setError("Enter a group name with at least 2 characters."); return; }
    if (!memberIds.length) { setError("Select at least one person to create a group."); return; }

    if (avatarFile) {
      const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!supportedTypes.includes(avatarFile.type)) {
        setError("Choose a JPG, PNG, WEBP, or GIF group image.");
        return;
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        setError("Group image must be 5 MB or smaller.");
        return;
      }
    }

    setBusy(true);
    setError("");
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser?.id) throw new Error("Your session has expired. Please sign in again.");
      if (session?.user?.id && session.user.id !== authUser.id) {
        throw new Error("Your session changed. Refresh Chatly and try creating the group again.");
      }

      const { data: groupId, error: groupError } = await supabase.rpc("create_group_conversation", {
        p_name: groupName,
        p_description: description.trim(),
        p_member_ids: memberIds,
      });
      if (groupError) throw groupError;
      if (!groupId) throw new Error("The group was not created. Please try again.");

      let avatarWarning = "";
      if (avatarFile) {
        try {
          const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
          const extension = extensions[avatarFile.type];
          const path = `${authUser.id}/groups/${groupId}/avatar.${extension}`;
          const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, {
            upsert: true, contentType: avatarFile.type,
          });
          if (uploadError) throw uploadError;
          const { data: publicImage } = supabase.storage.from("avatars").getPublicUrl(path);
          const avatarUrl = `${publicImage.publicUrl}${publicImage.publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
          const { error: avatarUpdateError } = await supabase.from("group_conversations")
            .update({ avatar_url: avatarUrl }).eq("id", groupId);
          if (avatarUpdateError) throw avatarUpdateError;
        } catch (avatarError) {
          console.error("Group created but avatar upload failed:", avatarError);
          avatarWarning = "Group created, but the group image could not be uploaded.";
        }
      }

      const { data: group, error: loadGroupError } = await supabase.from("group_conversations")
        .select("*").eq("id", groupId).single();
      if (loadGroupError) throw loadGroupError;
      onCreated?.(avatarWarning ? { ...group, avatar_upload_warning: avatarWarning } : group);
      onClose?.();
    } catch (err) {
      console.error("Group creation failed:", err);
      setError(err?.message || "Could not create this group. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group-create-backdrop" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
      <section className="group-create-dialog" role="dialog" aria-modal="true"
        aria-labelledby="group-create-title" aria-describedby="group-create-description">
        <header>
          <span className="group-create-icon"><Users size={20} /></span>
          <div className="group-create-heading">
            <h2 id="group-create-title">Create a group</h2>
            <p id="group-create-description">Bring people together in one conversation.</p>
          </div>
          <button type="button" aria-label="Close group creation" onClick={onClose} disabled={busy}><X size={18} /></button>
        </header>

        <form onSubmit={createGroup}>
          <div className="group-avatar-field">
            <span className="group-avatar-preview">{avatarPreview
              ? <img src={avatarPreview} alt="Group image preview" />
              : <Users size={24} />}</span>
            <label className="group-avatar-upload">
              <ImagePlus size={15} /> {avatarFile ? "Change group image" : "Add group image"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Choose group image" onChange={event => setAvatarFile(event.target.files?.[0] || null)} />
            </label>
            {avatarFile && <button type="button" className="group-avatar-remove"
              onClick={() => setAvatarFile(null)} disabled={busy}>Remove</button>}
            <small>Optional · JPG, PNG, WEBP, or GIF · up to 5 MB</small>
          </div>
          <label className="group-create-field">
            <span>Group name <small>{name.length}/80</small></span>
            <input autoFocus maxLength={80} value={name}
              onChange={event => { setName(event.target.value); setError(""); }}
              placeholder="e.g. Weekend plans" autoComplete="off" />
          </label>
          <label className="group-create-field">
            <span>Description <small>Optional · {description.length}/500</small></span>
            <textarea maxLength={500} rows={3} value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="What will this group be about?" />
          </label>

          <section className="group-member-picker" aria-label="Choose group members">
            <div className="group-member-picker-title">
              <div><strong>Add people</strong><span>Choose who can join this conversation</span></div>
              <span className="group-selected-count">{selected.length} selected</span>
            </div>
            {selectedPeople.length > 0 && (
              <div className="group-selected-members" aria-label="Selected members">
                {selectedPeople.map(person => (
                  <span className="group-selected-chip" key={person.id}>
                    <span className="group-chip-avatar">{person.avatar_url
                      ? <img src={person.avatar_url} alt="" />
                      : initials(person)}</span>
                    <span>{displayName(person)}</span>
                    <button type="button" aria-label={`Remove ${displayName(person)}`}
                      onClick={() => toggleMember(person.id)} disabled={busy}><X size={13} /></button>
                  </span>
                ))}
                <button type="button" className="group-clear-selection" onClick={clearMembers} disabled={busy}>
                  <Trash2 size={13} /> Clear
                </button>
              </div>
            )}
            <div className="group-member-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)}
                placeholder="Search by name or username…" aria-label="Search group members" />
              {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
            </div>
            <div className="group-member-options" role="listbox" aria-label="Available people" aria-multiselectable="true">
              {candidates.map(person => {
                const isSelected = selected.includes(person.id);
                return (
                  <button key={person.id} type="button" role="option" aria-selected={isSelected}
                    className={isSelected ? "selected" : ""}
                    onClick={() => toggleMember(person.id)} disabled={busy}>
                    <span className="group-member-avatar">{person.avatar_url
                      ? <img src={person.avatar_url} alt="" />
                      : initials(person)}</span>
                    <span className="group-member-person-copy">
                      <strong>{displayName(person)}</strong>
                      <small>{person.username ? `@${person.username}` : "Chatly member"}</small>
                    </span>
                    <span className="group-member-check">{isSelected ? <Check size={15} /> : null}</span>
                  </button>
                );
              })}
              {!candidates.length && (
                <div className="group-picker-empty">
                  <UserRound size={20} />
                  <span>{eligiblePeople.length ? "No people match your search." : "No other people are available yet."}</span>
                </div>
              )}
            </div>
          </section>

          {error && <p className="group-create-error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="group-cancel" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="group-submit" disabled={busy || name.trim().length < 2 || !selected.length}>
              {busy ? <><LoaderCircle size={16} className="spin" /> Creating…</> : <><Users size={16} /> Create group</>}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
