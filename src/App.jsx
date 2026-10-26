import { useEffect, useRef, useState } from "react";
import { MessageCircle, LogOut, UserRound, MessagesSquare, Settings, X, Camera, Save, KeyRound, Search, Bell, Heart, Users, MoreHorizontal, Grid3X3, ChevronLeft, Minimize2, Maximize2 } from "lucide-react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import Chat from "./components/Chat.jsx";
import Feed from "./components/Feed.jsx";
import SearchPeople from "./components/SearchPeople.jsx";
import SettingsDestination from "./components/SettingsDestination.jsx";
import NotificationsDestination from "./components/NotificationsDestination.jsx";
import PublicProfile from "./components/PublicProfile.jsx";

const initialProfile = { display_name: "", username: "", avatar_url: "", bio: "" };

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState("home");
  const [settingsSubpage, setSettingsSubpage] = useState(false);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("chatly-font-size") || "medium");
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem("chatly-font-family") || "system");
  const [fontSizeExpanded, setFontSizeExpanded] = useState(false);
  const [fontFamilyExpanded, setFontFamilyExpanded] = useState(false);
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState({ chats: false, notifications: false, privacy: false });
  const [chatPrefs, setChatPrefs] = useState(() => { const defaults = { enterToSend: true, mediaPreview: true, readReceipts: true, messageAlerts: true, activityAlerts: true, likesAlerts: true, commentAlerts: true, mentionAlerts: true, privateProfile: false, messageRequests: true, autoDownloadMedia: true }; try { return { ...defaults, ...JSON.parse(localStorage.getItem("chatly-chat-prefs") || "{}") }; } catch { return defaults; } });
  useEffect(() => { localStorage.setItem("chatly-chat-prefs", JSON.stringify(chatPrefs)); }, [chatPrefs]);
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
  useEffect(() => {
    if (!profileMenuOpen) return;
    function closeOnOutsideClick(event) {
      if (!event.target.closest(".global-profile-menu, .profile-page-head")) setProfileMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    function closeOnEscape(event) { if (event.key === "Escape") setProfileMenuOpen(false); }
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [profileMenuOpen]);
  const [profileStats, setProfileStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [myPosts, setMyPosts] = useState([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [myPostsError, setMyPostsError] = useState("");
  async function refreshMyProfilePosts() {
    if (!session?.user?.id) return;
    const [{ data, error }, countResult] = await Promise.all([
      supabase.from("posts").select("id,body,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", session.user.id)
    ]);
    if (error) {
      console.error("Profile posts refresh failed:", error);
      setMyPostsError("Your posts could not be refreshed. Please try again.");
      return;
    }
    setMyPosts(data || []);
    setMyPostsError("");
    setProfileStats(current => ({ ...current, posts: countResult.error ? (data?.length || 0) : (countResult.count || 0) }));
  }
  useEffect(() => {
    let cancelled = false;
    async function loadMyPosts() {
      if (!session?.user?.id) { setMyPosts([]); setMyPostsLoading(false); setMyPostsError(""); return; }
      setMyPostsLoading(true);
      setMyPostsError("");
      const { data, error } = await supabase.from("posts").select("id,body,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(100);
      if (cancelled) return;
      if (error) { console.error("Profile posts load failed:", error); setMyPostsError("Your posts could not be loaded. Please try again."); }
      else setMyPosts(data || []);
      setMyPostsLoading(false);
    }
    loadMyPosts();
    return () => { cancelled = true; };
  }, [session]);
  useEffect(() => {
    let cancelled = false;
    async function loadProfileStats() {
      if (!session?.user?.id) {
        setProfileStats({ posts: 0, followers: 0, following: 0 });
        return;
      }
      const userId = session.user.id;
      const [posts, followers, following] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId)
      ]);
      if (cancelled) return;
      const failed = posts.error || followers.error || following.error;
      if (failed) {
        console.error("Profile stats load failed:", failed);
        return;
      }
      setProfileStats({ posts: posts.count || 0, followers: followers.count || 0, following: following.count || 0 });
    }
    loadProfileStats();
    return () => { cancelled = true; };
  }, [session]);
  const [chatTarget, setChatTarget] = useState(null);
  const [requestedProfile, setRequestedProfile] = useState(null);
  const [viewedProfile, setViewedProfile] = useState(null);
  const [profileReturnTab, setProfileReturnTab] = useState("feed");
  function openPublicProfile(person) {
    if (!person?.id) return;
    if (person.id === session?.user?.id) { setTab("profile"); return; }
    setProfileReturnTab(tab === "public-profile" ? profileReturnTab : tab);
    setViewedProfile(person);
    setTab("public-profile");
  }
  const [globalVideo, setGlobalVideo] = useState(null);
  const [globalPlayerMinimized, setGlobalPlayerMinimized] = useState(false);
  const [globalPlayerPosition, setGlobalPlayerPosition] = useState(null);
  const playerDrag = useRef(null);
  function startPlayerDrag(event) {
    if (event.target.closest(".global-youtube-player-actions")) return;
    const rect = event.currentTarget.closest(".global-youtube-player").getBoundingClientRect();
    playerDrag.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setGlobalPlayerPosition({ x: rect.left, y: rect.top });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }
  useEffect(() => {
    function movePlayer(event) {
      if (!playerDrag.current) return;
      const width = document.querySelector(".global-youtube-player")?.offsetWidth || 320;
      const height = document.querySelector(".global-youtube-player")?.offsetHeight || 220;
      setGlobalPlayerPosition({
        x: Math.max(0, Math.min(window.innerWidth - width, event.clientX - playerDrag.current.offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - height, event.clientY - playerDrag.current.offsetY))
      });
    }
    function stopPlayer() { playerDrag.current = null; }
    window.addEventListener("pointermove", movePlayer);
    window.addEventListener("pointerup", stopPlayer);
    window.addEventListener("pointercancel", stopPlayer);
    return () => { window.removeEventListener("pointermove", movePlayer); window.removeEventListener("pointerup", stopPlayer); window.removeEventListener("pointercancel", stopPlayer); };
  }, []);
  function openChat(targetId) {
    setChatTarget(targetId || null);
    setTab("chats");
  }
  const [form, setForm] = useState(initialProfile);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [accountInfoExpanded, setAccountInfoExpanded] = useState(false);

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
      if (!session?.user) { setProfile(null); setAccountEmail(""); return; }
      // Avoid showing the previous account's profile while a new session is resolving.
      setProfile(null);
      setNotice("");
      const user = session.user;
      const metadata = user.user_metadata || {};
      const fallbackName = metadata.display_name || metadata.full_name || user.email?.split("@")[0] || "Chatly user";
      const { data, error } = await supabase.from("profiles")
        .select("id, username, display_name, avatar_url, bio").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Profile load failed:", error);
        setNotice("Your profile could not be loaded. Please refresh and try again.");
        return;
      }
      let next = data;
      if (!next) {
        const seed = { id: user.id, username: metadata.username || null, display_name: fallbackName, avatar_url: metadata.avatar_url || null, bio: metadata.bio || "" };
        const { data: inserted, error: insertError } = await supabase.from("profiles")
          .upsert(seed, { onConflict: "id" }).select("id, username, display_name, avatar_url, bio").single();
        if (cancelled) return;
        if (insertError) {
          console.error("Profile create failed:", insertError);
          // A parallel session/profile initializer may have created the row already.
          if (insertError.code === "23505") {
            const { data: existing, error: retryError } = await supabase.from("profiles")
              .select("id, username, display_name, avatar_url, bio").eq("id", user.id).maybeSingle();
            if (cancelled) return;
            if (retryError || !existing) {
              setNotice("Your profile could not be initialized. Please try again.");
              return;
            }
            next = existing;
          } else {
            setNotice("Your profile could not be created. Check your connection and try again.");
            return;
          }
        } else next = inserted;
      }
      setProfile(next);
      setAccountEmail(user.email || "");
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
        const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[avatarFile.type];
        if (!ext) throw new Error("Choose a JPG, PNG, WEBP, or GIF image.");
        const path = `${session.user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        // Replacing the same storage path can leave mobile browsers showing a cached avatar.
        const cacheKey = Date.now();
        avatar_url = `${data.publicUrl}${data.publicUrl.includes("?") ? "&" : "?"}v=${cacheKey}`;
      }
      const username = form.username.trim().toLowerCase() || null;
      if (username && !/^[a-z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3–20 characters: letters, numbers, or underscores.");
      if (username && username !== (profile?.username || "").toLowerCase()) {
        const { data: existing, error: usernameError } = await supabase.from("profiles")
          .select("id").eq("username", username).neq("id", session.user.id).maybeSingle();
        if (usernameError) throw new Error("Could not verify username availability. Please try again.");
        if (existing) throw new Error("That username is already taken. Choose another one.");
      }
      const displayName = form.display_name.trim();
      if (!displayName || displayName.length > 40) throw new Error("Display name must be between 1 and 40 characters.");
      if (form.bio.trim().length > 160) throw new Error("Bio must be 160 characters or fewer.");
      const payload = { id: session.user.id, display_name: displayName, username, avatar_url, bio: form.bio.trim() };
      const { data: saved, error } = await supabase.from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, username, display_name, avatar_url, bio").single();
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
      <div className="global-profile-menu"><button className="global-profile-trigger" aria-label="Open navigation menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(v => !v)}><span className="global-profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.dataset.avatarFallback = (profile?.display_name || "C").slice(0,1).toUpperCase(); }} onLoad={e => { e.currentTarget.style.display = ""; e.currentTarget.parentElement.classList.remove("avatar-image-failed"); delete e.currentTarget.parentElement.dataset.avatarFallback; }}/> : (profile?.display_name || "C").slice(0,1).toUpperCase()}</span></button>{profileMenuOpen && <div className="global-profile-dropdown" role="menu"><button role="menuitem" aria-label="Profile" title="Profile" onClick={() => { setProfileMenuOpen(false); setTab("profile"); }}><span><UserRound size={18}/></span></button><button role="menuitem" aria-label="Search" title="Search" onClick={() => { setProfileMenuOpen(false); setTab("search"); }}><span><Search size={18}/></span></button><button role="menuitem" aria-label="Chats" title="Chats" onClick={() => { setProfileMenuOpen(false); setTab("chats"); }}><span><MessagesSquare size={18}/></span></button><button role="menuitem" aria-label="Notifications" title="Notifications" onClick={() => { setProfileMenuOpen(false); setTab("notifications"); }}><span><Bell size={18}/></span></button><button role="menuitem" aria-label="Settings" title="Settings" onClick={() => { setProfileMenuOpen(false); setSettingsOpen(false); setSettingsView("home"); setSettingsSubpage(false); setTab("settings"); }}><span><Settings size={18}/></span></button><button role="menuitem" aria-label="Logout" title="Logout" onClick={() => { setProfileMenuOpen(false); supabase.auth.signOut(); }}><span><LogOut size={18}/></span></button></div>}</div>
    </header>}
    {tab !== "feed" && tab !== "chats" && tab !== "public-profile" && tab !== "settings" && <div className="destination-topline"><button className="page-back-to-feed" onClick={() => { setTab("feed"); setProfileMenuOpen(false); }} aria-label="Back to feed"><ChevronLeft size={20}/></button><strong className="destination-current-title">{tab === "profile" ? `${profile?.username || profile?.display_name || "Your"}’s profile` : ({account:"Account",search:"Explore",chats:"Chats",notifications:"Notifications",settings:"Settings"})[tab] || ""}</strong></div>}
    {tab === "notifications" && <NotificationsDestination session={session} onOpenProfile={openPublicProfile} />}
    {tab === "search" && <SearchPeople session={session} requestedProfile={requestedProfile} onProfileRequestHandled={() => setRequestedProfile(null)} onOpenProfile={openPublicProfile} onOpenChats={openChat} onPlayVideo={video => { setGlobalVideo(video); setGlobalPlayerMinimized(false); }} /> }
    {tab === "public-profile" && viewedProfile && <PublicProfile person={viewedProfile} session={session} onBack={() => { setViewedProfile(null); setTab(profileReturnTab); }} onOpenChats={openChat} />}{tab === "feed" && <Feed session={session} profile={profile} onOpenProfile={openPublicProfile} onPostsChanged={refreshMyProfilePosts} onFindFriends={() => setTab("search")}/>}
    {tab === "chats" && <Chat session={session} profile={profile} targetId={chatTarget} enterToSend={chatPrefs.enterToSend} onOpenProfile={openPublicProfile} onBackToFeed={() => { setChatTarget(null); setTab("feed"); }}/>}
    {tab === "profile" && <section className="profile-page"><div className="profile-page-head"><h2>{profile?.username ? `${profile.username}’s profile` : `${profile?.display_name || "Your"}’s profile`}</h2><button className="profile-menu-trigger" aria-label="Profile options" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen(v => !v)}><MoreHorizontal size={27}/></button>{profileMenuOpen && <div className="profile-dropdown"><button onClick={() => { setProfileMenuOpen(false); setNotice("Liked posts are coming soon."); }}>Liked <Heart size={16}/></button><button onClick={() => { setProfileMenuOpen(false); setTab("search"); }}>Contacts <Users size={16}/></button><button onClick={() => { setProfileMenuOpen(false); setSettingsOpen(false); setSettingsView("home"); setSettingsSubpage(false); setTab("settings"); }}>Account <KeyRound size={16}/></button><button onClick={() => { setProfileMenuOpen(false); setSettingsOpen(false); setSettingsView("home"); setSettingsSubpage(false); setTab("settings"); }}>App settings <Settings size={16}/></button></div>}</div><div className="profile-summary"><span className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.dataset.avatarFallback = (profile?.display_name || "C").slice(0,1).toUpperCase(); }} onLoad={e => { e.currentTarget.style.display = ""; e.currentTarget.parentElement.classList.remove("avatar-image-failed"); delete e.currentTarget.parentElement.dataset.avatarFallback; }}/> : (profile?.display_name || "C").slice(0,1).toUpperCase()}</span><div className="profile-counts"><div><b>{profileStats.posts}</b><span>posts</span></div><div><b>{profileStats.followers}</b><span>followers</span></div><div><b>{profileStats.following}</b><span>following</span></div></div></div><div className="profile-bio"><strong>{profile?.display_name || "Your name"}</strong>{profile?.username && <span className="profile-handle">@{profile.username}</span>}<p>{profile?.bio || "Welcome to my Chatly profile."}</p></div><button className="profile-edit-button" onClick={() => { setEditProfileOpen(true); setNotice(""); }}>Edit profile</button><div className="profile-grid-heading"><Grid3X3 size={18}/> Posts</div>{myPostsLoading ? <div className="profile-post-grid profile-post-grid-skeleton" aria-label="Loading posts" aria-busy="true">{[0,1,2,3,4,5].map(item => <div className="profile-post-tile profile-post-skeleton" key={item}><span/><span/><span/></div>)}</div> : myPostsError ? <div className="profile-posts-empty" role="status"><MessageCircle size={26}/><h3>Posts unavailable</h3><p>{myPostsError}</p><button className="profile-edit-button" onClick={refreshMyProfilePosts}>Try again</button></div> : myPosts.length ? <div className="profile-post-grid">{myPosts.map(post => <article className="profile-post-tile" key={post.id}><p>{post.body}</p><small>{post.created_at ? new Date(post.created_at).toLocaleDateString([], { dateStyle: "medium" }) : "Recently"}</small></article>)}</div> : <div className="profile-posts-empty"><MessageCircle size={26}/><h3>No posts yet</h3><p>Share your first post and it will appear here.</p><button className="profile-edit-button" onClick={() => setTab("feed")}>Go to feed</button></div>}</section>}
    {editProfileOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditProfileOpen(false); }}>
      <section className="profile-modal edit-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <header className="modal-header"><div><h2 id="edit-profile-title">Edit profile</h2></div><button className="icon-button" onClick={() => setEditProfileOpen(false)} aria-label="Close edit profile"><X size={18}/></button></header>
        <form onSubmit={saveProfile} className="profile-form">
          <div className="profile-edit-avatar-row"><span className="avatar avatar-large">{avatarPreview ? <img src={avatarPreview} alt="Avatar preview" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.dataset.avatarFallback = (form.display_name || "C").slice(0,1).toUpperCase(); }} onLoad={e => { e.currentTarget.style.display = ""; e.currentTarget.parentElement.classList.remove("avatar-image-failed"); delete e.currentTarget.parentElement.dataset.avatarFallback; }}/> : form.avatar_url ? <img src={form.avatar_url} alt="Profile" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.dataset.avatarFallback = (form.display_name || "C").slice(0,1).toUpperCase(); }} onLoad={e => { e.currentTarget.style.display = ""; e.currentTarget.parentElement.classList.remove("avatar-image-failed"); delete e.currentTarget.parentElement.dataset.avatarFallback; }}/> : (form.display_name || "C").slice(0,1).toUpperCase()}</span><label className="upload-avatar"><Camera size={15}/> Change photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) { setNotice("Choose a JPG, PNG, WEBP, or GIF image."); e.target.value = ""; return; } if (file.size > 5 * 1024 * 1024) { setNotice("Profile photos must be 5 MB or smaller."); e.target.value = ""; return; } setNotice(""); setAvatarFile(file); }}/></label>{(avatarFile || form.avatar_url) && <button type="button" className="text-button" onClick={() => { setAvatarFile(null); setForm(f => ({ ...f, avatar_url: "" })); setNotice("Photo removed. Save profile to apply."); }}>Remove photo</button>}</div>
          <label className="profile-edit-name">Display name<input value={form.display_name} maxLength={40} onChange={e => setForm(f => ({...f, display_name:e.target.value}))} placeholder="Your name" required/></label>
          <label className="profile-edit-username">Username<div className="username-input"><span>@</span><input value={form.username} maxLength={20} onChange={e => setForm(f => ({...f, username:e.target.value}))} placeholder="yourusername"/></div></label>
          <label className="profile-edit-bio">Bio<textarea value={form.bio} maxLength={160} rows={3} onChange={e => setForm(f => ({...f, bio:e.target.value}))} placeholder="Tell people a little about yourself"/></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saving…" : <><Save size={16}/> Save profile</>}</button>
        </form>
        {notice && <p className="form-message">{notice}</p>}
      </section>
    </div>}
    {tab === "settings" && <SettingsDestination onBack={() => { setSettingsOpen(false); setSettingsView("home"); setSettingsSubpage(false); setTab("feed"); }} onSubpageChange={setSettingsSubpage} theme={theme} effectiveTheme={effectiveTheme} setTheme={setTheme} fontSize={fontSize} setFontSize={setFontSize} fontFamily={fontFamily} setFontFamily={setFontFamily} fontSizeExpanded={fontSizeExpanded} setFontSizeExpanded={setFontSizeExpanded} fontFamilyExpanded={fontFamilyExpanded} setFontFamilyExpanded={setFontFamilyExpanded} accountInfoExpanded={accountInfoExpanded} setAccountInfoExpanded={setAccountInfoExpanded} editProfileOpen={editProfileOpen} setEditProfileOpen={setEditProfileOpen} setNotice={setNotice} notice={notice} session={session} emailExpanded={emailExpanded} setEmailExpanded={setEmailExpanded} accountEmail={accountEmail} setAccountEmail={setAccountEmail} supabase={supabase} passwordExpanded={passwordExpanded} setPasswordExpanded={setPasswordExpanded} password={password} setPassword={setPassword} setNewPassword={setNewPassword} settingsExpanded={settingsExpanded} setSettingsExpanded={setSettingsExpanded} chatPrefs={chatPrefs} setChatPrefs={setChatPrefs} />}
    {globalVideo && <aside className={"global-youtube-player" + (globalPlayerMinimized ? " is-minimized" : "")} style={globalPlayerPosition ? { left: globalPlayerPosition.x, top: globalPlayerPosition.y, right: "auto", bottom: "auto" } : undefined} aria-label="YouTube player">
      <div className="global-youtube-player-head" onPointerDown={startPlayerDrag} title="Drag to move player"><span>{globalVideo.snippet?.title || "YouTube video"}</span>
        <div className="global-youtube-player-actions"><a href={"https://www.youtube.com/watch?v=" + encodeURIComponent(globalVideo.id?.videoId || "")} target="_blank" rel="noreferrer" aria-label="Open video on YouTube" title="Open on YouTube">↗</a>
          <button type="button" aria-label={globalPlayerMinimized ? "Restore player" : "Minimize player"} onClick={() => setGlobalPlayerMinimized(value => !value)}>{globalPlayerMinimized ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}</button>
          <button type="button" aria-label="Close player" onClick={() => { setGlobalVideo(null); setGlobalPlayerMinimized(false); }}><X size={16}/></button>
        </div>
      </div>
      {!globalPlayerMinimized && <div className="global-youtube-player-frame">
        <iframe key={globalVideo.id?.videoId} src={"https://www.youtube-nocookie.com/embed/" + encodeURIComponent(globalVideo.id?.videoId || "") + "?autoplay=1&rel=0&playsinline=1"} title={globalVideo.snippet?.title || "YouTube video player"} allow="autoplay; encrypted-media; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>}
    </aside>}
  </div>;
}