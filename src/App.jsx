import { useEffect, useState } from "react";
import { MessageCircle, LogOut, Home, MessagesSquare, Settings, X, Camera, Save, KeyRound, Search, Bell, Heart, Users, MoreHorizontal, Grid3X3 } from "lucide-react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import Chat from "./components/Chat.jsx";
import Feed from "./components/Feed.jsx";
import SearchPeople from "./components/SearchPeople.jsx";

const initialProfile = { display_name: "", username: "", avatar_url: "", bio: "" };

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState("home");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("chatly-font-size") || "medium");
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem("chatly-font-family") || "system");
  const [fontSizeExpanded, setFontSizeExpanded] = useState(false);
  const [fontFamilyExpanded, setFontFamilyExpanded] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [tab, setTab] = useState("feed");
  const [theme, setTheme] = useState(() => localStorage.getItem("chatly-theme") || "system");
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches || false);
  useEffect(() => {
    localStorage.setItem("chatly-theme", theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [theme]);
  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => { localStorage.setItem("chatly-font-size", fontSize); localStorage.setItem("chatly-font-family", fontFamily); }, [fontSize, fontFamily]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileStats, setProfileStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [chatTarget, setChatTarget] = useState(null);
  function openChat(targetId) {
    setChatTarget(targetId || null);
    setTab("chats");
  }
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
        const seed = { id: user.id, username: metadata.username || null, display_name: fallbackName, avatar_url: metadata.avatar_url || null, bio: metadata.bio || "" };
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
      setForm({ display_name: next.display_name || fallbackName, username: next.username || "", avatar_url: next.avatar_url || "", bio: next.bio || metadata.bio || "" });
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
        data: { display_name: saved.display_name, username: saved.username, avatar_url: saved.avatar_url, bio: form.bio.trim() }
      });
      if (metadataError) console.warn("Auth metadata sync failed:", metadataError.message);
      setProfile({ ...saved, bio: form.bio.trim() });
      setForm({ display_name: saved.display_name || "", username: saved.username || "", avatar_url: saved.avatar_url || "", bio: form.bio || "" });
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

  return <div className={`app-shell theme-${effectiveTheme} font-${fontSize} family-${fontFamily}`} style={effectiveTheme === "dark" ? { colorScheme: "dark", background: "#141419", color: "#f4f4f7", "--app-bg": "#141419", "--surface": "#202027", "--text": "#f4f4f7", "--muted": "#a5a5b2", "--border": "#34343d" } : { colorScheme: "light", "--app-bg": "#f5f5f7", "--surface": "#ffffff", "--text": "#17171b", "--muted": "#888894", "--border": "#e4e4e9" }}>
    {tab === "feed" && <header className="topbar">
      <div className="brand">chatly</div>
      <button className="header-notifications" aria-label="Notifications" onClick={() => setTab("notifications")}><Bell size={24}/></button>
    </header>}
    {tab === "notifications" && <section className="notifications-page"><header><h2>Notifications</h2></header><div className="notifications-empty"><Bell size={38}/><h3>Notifications</h3><p>You're all caught up. New activity will appear here.</p></div></section>}
    {tab === "search" && <SearchPeople session={session} onOpenChats={openChat}/>}{tab === "feed" && <Feed session={session} profile={profile} onFindFriends={() => setTab("chats")}/>}
    {tab === "chats" && <Chat session={session} profile={profile} targetId={chatTarget}/>}
    {tab === "profile" && <section className="profile-page"><div className="profile-page-head"><h2>{profile?.username || "Profile"}</h2><button className="profile-menu-trigger" aria-label="Profile menu" onClick={() => setProfileMenuOpen(v => !v)}><MoreHorizontal size={27}/></button>{profileMenuOpen && <div className="profile-dropdown"><button onClick={() => { setProfileMenuOpen(false); setNotice("Liked posts are coming soon."); }}>Liked Posts <Heart size={16}/></button><button onClick={() => { setProfileMenuOpen(false); setTab("search"); }}>Contacts <Users size={16}/></button><button onClick={() => { setProfileMenuOpen(false); setSettingsOpen(true); setSettingsView("account"); }}>Account <KeyRound size={16}/></button><button onClick={() => { setProfileMenuOpen(false); setSettingsOpen(true); setSettingsView("app-settings"); }}>App settings <Settings size={16}/></button></div>}</div><div className="profile-summary"><span className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile"/> : (profile?.display_name || "C").slice(0,1).toUpperCase()}</span><div className="profile-counts"><div><b>{profileStats.posts}</b><span>posts</span></div><div><b>{profileStats.followers}</b><span>followers</span></div><div><b>{profileStats.following}</b><span>following</span></div></div></div><div className="profile-bio"><strong>{profile?.display_name || "Your name"}</strong><p>{profile?.bio || "Welcome to my Chatly profile."}</p></div><button className="profile-edit-button" onClick={() => { setEditProfileOpen(true); setNotice(""); }}>Edit profile</button><div className="profile-grid-heading"><Grid3X3 size={18}/> Posts</div></section>}
    <nav className="bottom-tabs" aria-label="Main navigation">
      <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}><Home size={20}/><span>Feed</span></button><button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}><Search size={20}/><span>Search</span></button>
      <button className={tab === "chats" ? "active" : ""} onClick={() => setTab("chats")}><MessagesSquare size={20}/><span>Chats</span></button>
      <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><span className="nav-profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : (profile?.display_name || "C").slice(0,1).toUpperCase()}</span><span>Profile</span></button>
    </nav>
    {editProfileOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditProfileOpen(false); }}>
      <section className="profile-modal edit-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <header className="modal-header"><div><h2 id="edit-profile-title">Edit profile</h2><p>Update how people see you on Chatly.</p></div><button className="icon-button" onClick={() => setEditProfileOpen(false)} aria-label="Close edit profile"><X size={18}/></button></header>
        <form onSubmit={saveProfile} className="profile-form">
          <div className="profile-edit-avatar-row"><div className="avatar-editor"><span className="avatar avatar-large">{avatarFile ? <img src={URL.createObjectURL(avatarFile)} alt="Avatar preview"/> : form.avatar_url ? <img src={form.avatar_url} alt="Profile"/> : (form.display_name || "C").slice(0,1).toUpperCase()}</span><label className="upload-avatar"><Camera size={15}/> Change photo<input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)}/></label></div>
          <label className="profile-edit-name">Display name<input value={form.display_name} maxLength={40} onChange={e => setForm(f => ({...f, display_name:e.target.value}))} placeholder="Your name" required/></label>
          <label className="profile-edit-username">Username <span className="field-hint">3–20 letters, numbers, underscores</span><div className="username-input"><span>@</span><input value={form.username} maxLength={20} onChange={e => setForm(f => ({...f, username:e.target.value}))} placeholder="yourusername"/></div></label></div>
          <label className="profile-edit-bio">Bio <span className="field-hint">Up to 160 characters</span><textarea value={form.bio} maxLength={160} rows={3} onChange={e => setForm(f => ({...f, bio:e.target.value}))} placeholder="Tell people a little about yourself"/></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : <><Save size={16}/> Save profile</>}</button>
        </form>
        {notice && <p className="form-message">{notice}</p>}
      </section>
    </div>}
    {settingsOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
      <section className="profile-modal settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="modal-header"><div><h2 id="settings-title">Settings</h2><p>Manage your Chatly preferences.</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18}/></button></header>
        {settingsView !== "home" && <button className="settings-back" onClick={() => setSettingsView("home")}>‹ Menu</button>}
        {settingsView === "home" && <div className="settings-options">
          <button onClick={() => setSettingsView("account")}><span className="settings-option-icon"><KeyRound size={18}/></span><span><b>Account</b><small>Password and sign-in</small></span><span className="settings-chevron">›</span></button>
          <button onClick={() => setSettingsView("app-settings")}><span className="settings-option-icon"><Settings size={18}/></span><span><b>App settings</b><small>Fonts and theme</small></span><span className="settings-chevron">›</span></button>
        </div>}
        {settingsView === "account" && <section className="settings-section account-view">
          <div className="settings-view-heading"><h3>Account</h3><button className="account-logout-top" title="Log out" aria-label="Log out" onClick={() => supabase.auth.signOut()}><LogOut size={17}/></button></div>
          <button className="style-expander" onClick={() => setFontSizeExpanded(v => !v)}><span>Password settings</span><span>{fontSizeExpanded ? "−" : "+"}</span></button>
          {fontSizeExpanded && <form className="password-form" onSubmit={setNewPassword}><label>New password<input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="secondary-button" disabled={!password}>Update password</button></form>}
        </section>}
        {settingsView === "app-settings" && <section className="settings-section app-style-controls">
          <div className="settings-view-heading"><h3>App settings</h3><button type="button" className={effectiveTheme === "dark" ? "theme-switch on" : "theme-switch"} role="switch" aria-checked={effectiveTheme === "dark"} aria-label="Toggle theme" onClick={() => setTheme(effectiveTheme === "dark" ? "light" : "dark")}><span/></button></div>
          <button className="style-expander" onClick={() => {setFontSizeExpanded(v => !v); setFontFamilyExpanded(v => !v)}}><span>Fonts</span><span>{fontSizeExpanded || fontFamilyExpanded ? "−" : "+"}</span></button>
          {(fontSizeExpanded || fontFamilyExpanded) && <>
            <div className="font-setting-group"><span>Font size</span><div className="style-choice-row">{["small","medium","large"].map(value => <button key={value} className={fontSize === value ? "selected" : ""} onClick={() => setFontSize(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></div>
            <div className="font-setting-group"><span>Font family</span><div className="style-choice-row">{[{value:"system",label:"System"},{value:"sans",label:"Sans"},{value:"serif",label:"Serif"}].map(item => <button key={item.value} className={fontFamily === item.value ? "selected" : ""} onClick={() => setFontFamily(item.value)}>{item.label}</button>)}</div></div>
          </>}
        </section>}
        <button type="button" className="logout-settings modal-logout" onClick={() => supabase.auth.signOut()}><LogOut size={16}/> Log out</button>
        {notice && <p className="form-message">{notice}</p>}
      </section>
    </div>}
  </div>;
}