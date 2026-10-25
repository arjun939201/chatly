import { useEffect, useState } from "react";
import { MessageCircle, LogOut, Home, MessagesSquare, Settings, X, Camera, Save, KeyRound } from "lucide-react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import Chat from "./components/Chat.jsx";
import Feed from "./components/Feed.jsx";

const initialProfile = { display_name: "", username: "", avatar_url: "" };

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState("feed");
  const [form, setForm] = useState(initialProfile);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!supabase) { setConfigError(true); setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setLoading(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!session?.user) { setProfile(null); return; }
      const user = session.user;
      const metadata = user.user_metadata || {};
      const fallbackName = metadata.display_name || metadata.full_name || user.email?.split("@")[0] || "Chatly user";
      const { data, error } = await supabase.from("profiles")
        .select("id, username, display_name, avatar_url").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Profile load failed:", error);
        setNotice(`Could not load profile: ${error.message}`);
        return;
      }
      let next = data;
      if (!next) {
        const seed = { id: user.id, username: metadata.username || null, display_name: fallbackName, avatar_url: metadata.avatar_url || null };
        const { data: inserted, error: insertError } = await supabase.from("profiles")
          .upsert(seed, { onConflict: "id" }).select("id, username, display_name, avatar_url").single();
        if (cancelled) return;
        if (insertError) {
          console.error("Profile create failed:", insertError);
          setNotice(`Could not create profile: ${insertError.message}`);
          next = seed;
        } else next = inserted;
      }
      setProfile(next);
      setForm({ display_name: next.display_name || fallbackName, username: next.username || "", avatar_url: next.avatar_url || "" });
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true); setNotice("");
    try {
      let avatar_url = form.avatar_url;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = data.publicUrl;
      }
      const username = form.username.trim().toLowerCase() || null;
      if (username && !/^[a-z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3–20 characters: letters, numbers, or underscores.");
      const payload = { id: session.user.id, display_name: form.display_name.trim() || "Chatly user", username, avatar_url };
      const { data: saved, error } = await supabase.from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, username, display_name, avatar_url").single();
      if (error) throw error;
      // Keep Auth metadata in sync as a fallback, while the profiles row remains authoritative.
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { display_name: saved.display_name, username: saved.username, avatar_url: saved.avatar_url }
      });
      if (metadataError) console.warn("Auth metadata sync failed:", metadataError.message);
      setProfile(saved);
      setForm({ display_name: saved.display_name || "", username: saved.username || "", avatar_url: saved.avatar_url || "" });
      setAvatarFile(null);
      setNotice("Profile saved successfully.");
    } catch (error) { setNotice(error.message || "Could not save profile."); }
    finally { setSaving(false); }
  }

  async function setNewPassword(event) {
    event.preventDefault(); setNotice("");
    if (password.length < 6) { setNotice("Use at least 6 characters for your password."); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setNotice(error.message);
    else { setPassword(""); setNotice("Password updated."); }
  }

  if (configError) return <main className="setup-screen"><div className="setup-card"><MessageCircle size={38}/><h1>Set up Chatly</h1><p>Add your Supabase project URL and public anon key to <code>.env.local</code> using <code>.env.example</code>, then restart the dev server.</p></div></main>;
  if (loading) return <main className="loading">Loading Chatly…</main>;
  if (!session) return <Auth />;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><MessageCircle size={20}/></span> Chatly</div>
      <div className="account">
        <button className="account-profile" onClick={() => { setSettingsOpen(true); setNotice(""); }} aria-label="Open profile settings">
          <span className="avatar avatar-small">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : (profile?.display_name || "C").slice(0,1).toUpperCase()}</span>
          <span className="account-copy"><strong>{profile?.display_name || session.user.user_metadata?.full_name || "Your profile"}</strong><small>{profile?.username ? `@${profile.username}` : "Set your username"}</small></span>
        </button>

      </div>
    </header>
    {tab === "feed" && <Feed session={session} profile={profile} onFindFriends={() => setTab("chats")}/>}
    {tab === "chats" && <Chat session={session} profile={profile}/>}
    {tab === "settings" && <section className="settings-home"><div className="settings-home-card"><span className="avatar avatar-large">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : (profile?.display_name || "C").slice(0,1).toUpperCase()}</span><h2>{profile?.display_name || "Your profile"}</h2><p>{profile?.username ? "@"+profile.username : "Make your profile yours"}</p><button className="primary-button" onClick={() => setSettingsOpen(true)}>Edit profile</button><button className="logout-settings" onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Log out</button></div></section>}
    <nav className="bottom-tabs" aria-label="Main navigation">
      <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}><Home size={20}/><span>Feed</span></button>
      <button className={tab === "chats" ? "active" : ""} onClick={() => setTab("chats")}><MessagesSquare size={20}/><span>Chats</span></button>
      <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings size={20}/><span>Settings</span></button>
    </nav>
    {settingsOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="modal-header"><div><h2 id="profile-title">Profile settings</h2><p>Manage your Chatly identity</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18}/></button></header>
        <form onSubmit={saveProfile} className="profile-form">
          <div className="avatar-editor">
            <span className="avatar avatar-large">{avatarFile ? <img src={URL.createObjectURL(avatarFile)} alt="Avatar preview"/> : form.avatar_url ? <img src={form.avatar_url} alt="Profile"/> : (form.display_name || "C").slice(0,1).toUpperCase()}</span>
            <label className="upload-avatar"><Camera size={15}/> Change photo<input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)}/></label>
          </div>
          <label>Display name<input value={form.display_name} maxLength={40} onChange={e => setForm(f => ({...f, display_name:e.target.value}))} placeholder="Your name" required/></label>
          <label>Username <span className="field-hint">Optional · 3–20 letters, numbers, underscores</span><div className="username-input"><span>@</span><input value={form.username} maxLength={20} onChange={e => setForm(f => ({...f, username:e.target.value}))} placeholder="yourusername"/></div></label>
          <label>Email address<input value={session.user.email || ""} readOnly/></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : <><Save size={16}/> Save profile</>}</button>
        </form>
        <form className="password-form" onSubmit={setNewPassword}>
          <h3><KeyRound size={16}/> Optional password</h3><p>Set a password if you'd like another way to sign in.</p>
          <label>New password<input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters"/></label>
          <button className="secondary-button" disabled={!password}>Set password</button>
        </form>
        <button type="button" className="logout-settings modal-logout" onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Log out of Chatly</button>
        {notice && <p className="form-message">{notice}</p>}
      </section>
    </div>}
  </div>;
}