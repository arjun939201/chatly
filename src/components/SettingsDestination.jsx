import { useEffect, useState } from "react";
import { ArrowLeft, UserRound, ShieldCheck, Bell, Palette, MessageCircle, CircleHelp, Info, LogOut, Trash2, ChevronRight, Sun, Moon, Monitor, Type, KeyRound, Mail, UserCog, Check } from "lucide-react";
import "./SettingsDestination.css";

const groups = [
  { label: "YOUR ACCOUNT", items: [{ id: "account", title: "Account", detail: "Personal information and sign-in", Icon: UserRound }] },
  { label: "PREFERENCES", items: [
    { id: "privacy", title: "Privacy & security", detail: "Read receipts and account privacy", Icon: ShieldCheck },
    { id: "notifications", title: "Notifications", detail: "Choose what you want to be notified about", Icon: Bell },
    { id: "appearance", title: "Appearance", detail: "Theme and text preferences", Icon: Palette },
    { id: "chats", title: "Chats", detail: "Message and media preferences", Icon: MessageCircle },
  ]},
  { label: "MORE", items: [
    { id: "help", title: "Help & support", detail: "Get help or report a problem", Icon: CircleHelp },
    { id: "about", title: "About Chatly", detail: "App information and policies", Icon: Info },
  ]},
];

function Toggle({ title, detail, checked, onChange }) {
  return <label className="st-pref-row"><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={Boolean(checked)} onChange={e => onChange(e.target.checked)} /></label>;
}

export default function SettingsDestination({ onSubpageChange = () => {}, theme = "system", setTheme, fontSize, setFontSize, fontFamily, setFontFamily, setNotice, notice, session, accountEmail, setAccountEmail, supabase, password, setPassword, setNewPassword, chatPrefs, setChatPrefs, setEditProfileOpen }) {
  const [view, setView] = useState("home");
  const [settingsQuery, setSettingsQuery] = useState("");
  useEffect(() => {
    if (view === "home") return undefined;
    window.history.pushState({ chatlySettingsSubpage: view }, "");
    const handlePopState = () => {
      setView("home");
      onSubpageChange(false);
      setMessage("");
      setNotice("");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view, onSubpageChange, setNotice]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);\n  const [passwordVisible, setPasswordVisible] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteInfoOpen, setDeleteInfoOpen] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (!logoutOpen && !deleteInfoOpen) return undefined; const onKeyDown = event => { if (event.key === "Escape") { setLogoutOpen(false); setDeleteInfoOpen(false); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [logoutOpen, deleteInfoOpen]);
  const title = groups.flatMap(group => group.items).find(item => item.id === view)?.title || "Settings";
  const preferenceDefaults = { readReceipts: true, privateProfile: false, messageRequests: true, messageAlerts: true, activityAlerts: true, likesAlerts: true, commentAlerts: true, mentionAlerts: true, enterToSend: false, mediaPreview: true, autoDownloadMedia: true };
  const safePrefs = { ...preferenceDefaults, ...(chatPrefs || {}) };\n  const pref = (key, value) => setChatPrefs(current => ({ ...preferenceDefaults, ...(current || {}), [key]: value }));
  const back = () => { if (view !== "home") window.history.back(); };

  function detailContent() {
    if (view === "account") return <>
      <section className="st-card"><h2>PERSONAL INFORMATION</h2>
        <button className="st-detail-row" onClick={() => { setEditProfileOpen(true); setNotice(""); }}><UserCog/><span><strong>Edit profile</strong><small>Display name, username, photo and bio</small></span><ChevronRight/></button>
        <button className="st-detail-row" onClick={() => setEmailOpen(v => !v)}><Mail/><span><strong>Email address</strong><small>{session?.user?.email || "Manage your sign-in email"} · {session?.user?.email_confirmed_at ? "Verified" : "Not verified"}</small></span><ChevronRight/></button>
        {emailOpen && <form className="st-inline-form" onSubmit={async e => { e.preventDefault(); setNotice(""); setEmailSaving(true); try { const { error } = await supabase.auth.updateUser({ email: accountEmail.trim() }); setNotice(error ? error.message : "Email update requested. Check your inbox to confirm."); } catch (error) { setNotice(error.message || "Could not request email update."); } finally { setEmailSaving(false); } }}><label>New email address<input type="email" autoComplete="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" aria-describedby="st-email-hint" required/><small id="st-email-hint" className="st-password-hint">A confirmation email may be required before the address changes.</small></label><button disabled={emailSaving || !accountEmail.trim() || accountEmail.trim().toLowerCase() === session?.user?.email?.toLowerCase()}>{emailSaving ? "Requesting…" : "Update email"}</button></form>}
      </section>
      <section className="st-card"><h2>SECURITY & SIGN-IN</h2>
        <button className="st-detail-row" onClick={() => setPasswordOpen(v => !v)}><KeyRound/><span><strong>Change password</strong><small>Choose a new password</small></span><ChevronRight/></button>
        {passwordOpen && <form className="st-inline-form" onSubmit={async e => { e.preventDefault(); setNotice(""); setPasswordSaving(true); try { await setNewPassword(e); } finally { setPasswordSaving(false); } }}><label>New password<input type={passwordVisible ? "text" : "password"} autoComplete="new-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required/><button type="button" className="st-reset-button" onClick={() => setPasswordVisible(v => !v)} aria-pressed={passwordVisible}>{passwordVisible ? "Hide password" : "Show password"}</button><button type="button" className="st-reset-button" onClick={() => setPasswordVisible(v => !v)} aria-pressed={passwordVisible}>{passwordVisible ? "Hide password" : "Show password"}</button><small className="st-password-hint" aria-live="polite">{password.length === 0 ? "Use at least 6 characters." : password.length < 6 ? `${6 - password.length} more character${6-password.length===1?"":"s"} needed.` : /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) ? "Password meets the length and character mix suggestions." : "Consider mixing uppercase, lowercase, and numbers for a stronger password."}</small></label><button disabled={passwordSaving || password.length < 6}>{passwordSaving ? "Updating…" : "Update password"}</button></form>}
        <button className="st-detail-row" onClick={() => setLogoutOpen(true)}><LogOut/><span><strong>Log out</strong><small>Sign out of this device</small></span><ChevronRight/></button>
      </section>
      <section className="st-card st-danger"><h2>ACCOUNT MANAGEMENT</h2><button className="st-detail-row" onClick={() => setDeleteInfoOpen(true)}><Trash2/><span><strong>Delete account</strong><small>Permanently remove your account and data</small></span><ChevronRight/></button></section>
      {notice && <p className="st-message" role="status">{notice}</p>}
    </>;
    if (view === "privacy") return <section className="st-card"><h2>MESSAGING PRIVACY</h2><Toggle title="Read receipts" detail="Let people know when you have read their messages" checked={safePrefs.readReceipts} onChange={v => pref("readReceipts", v)}/><Toggle title="Private profile" detail="Keep your profile visible only to approved followers (local preference)" checked={chatPrefs.privateProfile ?? false} onChange={v => pref("privateProfile", v)}/><Toggle title="Message requests" detail="Allow messages from people outside your connections" checked={chatPrefs.messageRequests ?? true} onChange={v => pref("messageRequests", v)}/><p className="st-note">Saved on this device. Server-side enforcement requires matching backend support.</p></section>;
    if (view === "notifications") return <section className="st-card"><h2>NOTIFICATION PREFERENCES</h2><Toggle title="Message alerts" detail="Get in-app alerts for new messages" checked={chatPrefs.messageAlerts} onChange={v => pref("messageAlerts", v)}/><Toggle title="Activity alerts" detail="Get alerts about community activity" checked={chatPrefs.activityAlerts} onChange={v => pref("activityAlerts", v)}/><Toggle title="Likes" detail="Alerts when someone likes your posts" checked={chatPrefs.likesAlerts ?? true} onChange={v => pref("likesAlerts", v)}/><Toggle title="Comments" detail="Alerts for comments on your posts" checked={chatPrefs.commentAlerts ?? true} onChange={v => pref("commentAlerts", v)}/><Toggle title="Mentions" detail="Alerts when someone mentions you" checked={chatPrefs.mentionAlerts ?? true} onChange={v => pref("mentionAlerts", v)}/><p className="st-note">These are device-level preferences and do not change operating-system notification permissions.</p><button type="button" className="st-reset-button" onClick={() => setChatPrefs(current => ({ ...current, messageAlerts: true, activityAlerts: true, likesAlerts: true, commentAlerts: true, mentionAlerts: true }))}>Reset notification preferences</button></section>;
    if (view === "chats") return <section className="st-card"><h2>MESSAGE PREFERENCES</h2><Toggle title="Enter to send" detail="Send messages by pressing Enter" checked={chatPrefs.enterToSend} onChange={v => pref("enterToSend", v)}/><Toggle title="Media previews" detail="Show previews for shared media when available" checked={chatPrefs.mediaPreview} onChange={v => pref("mediaPreview", v)}/><Toggle title="Auto-download media" detail="Automatically load shared images and videos (local preference)" checked={chatPrefs.autoDownloadMedia ?? true} onChange={v => pref("autoDownloadMedia", v)}/><button type="button" className="st-reset-button" onClick={() => setChatPrefs(current => ({ ...current, enterToSend: false, mediaPreview: true, autoDownloadMedia: true }))}>Reset chat preferences</button><p className="st-note">Restore default message preferences on this device.</p></section>;
    if (view === "appearance") return <>
      <section className="st-card"><h2>THEME</h2><div className="st-theme-options">{[{id:"light",label:"Light",Icon:Sun},{id:"dark",label:"Dark",Icon:Moon},{id:"system",label:"System",Icon:Monitor}].map(({id,label,Icon}) => <button key={id} className={theme === id ? "selected" : ""} aria-pressed={theme === id} onClick={() => setTheme(id)}><Icon/><span>{label}</span>{theme === id && <Check/>}</button>)}</div></section>
      <section className="st-card"><h2>TEXT</h2><div className="st-choice"><span><Type/>Text size</span><div>{["small","medium","large"].map(v => <button key={v} className={fontSize === v ? "selected" : ""} onClick={() => setFontSize(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div></div><div className="st-choice"><span>Font style</span><div>{[{id:"system",label:"System"},{id:"sans",label:"Sans"},{id:"serif",label:"Serif"}].map(v => <button key={v.id} className={fontFamily === v.id ? "selected" : ""} onClick={() => setFontFamily(v.id)}>{v.label}</button>)}</div></div></section>
    </>;
    if (view === "help") return <section className="st-card"><h2>HOW CAN WE HELP?</h2><div className="st-info"><CircleHelp/><span><strong>Chatly support</strong><p>For account, messaging, or technical issues, contact the Chatly project support team.</p></span></div><button className="st-detail-row" onClick={() => setMessage("Please share the issue with the Chatly project support team.")}><span><strong>Report a problem</strong><small>Tell us about something that is not working</small></span><ChevronRight/></button>{message && <p className="st-message" role="status">{message}</p>}</section>;
    if (view === "about") return <section className="st-card"><h2>APP INFORMATION</h2><div className="st-info"><span className="st-logo">c</span><span><strong>Chatly</strong><p>Connect, share, and chat with your community.</p><small>Version 1.0.0</small></span></div><button className="st-detail-row" onClick={() => setMessage("Privacy policy and terms will be available here when published.")}><span><strong>Privacy policy & terms</strong><small>Review Chatly policies</small></span><ChevronRight/></button>{message && <p className="st-message" role="status">{message}</p>}</section>;
    return null;
  }

  return <section className="destination-page settings-page app-settings-destination-page st-settings">
    {view === "home" ? <>
      <header className="st-intro"><span>PERSONALIZE YOUR EXPERIENCE</span><h1>Settings</h1><p>Make Chatly feel like yours.</p></header>
      <label className="st-search"><span className="sr-only">Search settings</span><input type="search" value={settingsQuery} onChange={e => setSettingsQuery(e.target.value)} placeholder="Search settings…" aria-label="Search settings" aria-controls="st-settings-results"/></label><p className="sr-only" role="status" aria-live="polite">{settingsQuery ? `${groups.flatMap(group => group.items).filter(item => `${item.title} ${item.detail} ${({privacy:"security visibility",notifications:"alerts push",appearance:"display color font",chats:"messages media typing",account:"login password email",help:"support contact",about:"version app"}[item.id] || "")}`.toLowerCase().includes(settingsQuery.trim().toLowerCase())).length} settings found` : "Showing all settings"}</p>
      {groups.map(group => { const matches = group.items.filter(item => `${item.title} ${item.detail} ${({privacy:"security visibility",notifications:"alerts push",appearance:"display color font",chats:"messages media typing",account:"login password email",help:"support contact",about:"version app"}[item.id] || "")}`.toLowerCase().includes(settingsQuery.trim().toLowerCase())); return matches.length ? <section className="st-group" key={group.label}><h2>{group.label}</h2><div className="st-nav-card">{matches.map(({id,title,detail,Icon}) => <button key={id} className="st-nav-row" onClick={() => { setView(id); setSettingsQuery(""); onSubpageChange(true); setNotice(""); setMessage(""); }}><span className="st-icon"><Icon/></span><span className="st-nav-copy"><strong>{title}</strong><small>{detail}</small></span><ChevronRight className="st-chevron"/></button>)}</div></section> : null; })}
      {settingsQuery.trim() && !groups.some(group => group.items.some(item => `${item.title} ${item.detail} ${item.id}`.toLowerCase().includes(settingsQuery.trim().toLowerCase()))) && <p className="st-note" role="status">No settings match “{settingsQuery}”. Try another search.</p>}
      <div className="st-nav-card st-actions"><button className="st-nav-row st-logout" onClick={() => setLogoutOpen(true)}><span className="st-icon"><LogOut/></span><span className="st-nav-copy"><strong>Log out</strong><small>Sign out of your Chatly account</small></span><ChevronRight/></button><button className="st-nav-row st-danger" onClick={() => setDeleteInfoOpen(true)}><span className="st-icon"><Trash2/></span><span className="st-nav-copy"><strong>Delete account</strong><small>Permanently remove your account and data</small></span><ChevronRight/></button></div>
    </> : <><header className="st-subheader"><button aria-label="Back to settings" onClick={back}><ArrowLeft/></button><div><span>SETTINGS</span><h1>{title}</h1></div></header>{detailContent()}</>}
    {logoutOpen && <div className="st-overlay" onClick={e => { if (e.target === e.currentTarget) setLogoutOpen(false); }}><section className="st-dialog" role="alertdialog" aria-modal="true" aria-labelledby="st-logout-title"><h2 id="st-logout-title">Log out of Chatly?</h2><p>You will need to sign in again to access your account.</p><footer><button className="st-secondary" onClick={() => setLogoutOpen(false)}>Cancel</button><button onClick={() => supabase.auth.signOut()}>Log out</button></footer></section></div>}
    {deleteInfoOpen && <div className="st-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteInfoOpen(false); }}><section className="st-dialog" role="alertdialog" aria-modal="true" aria-labelledby="st-delete-title"><h2 id="st-delete-title">Delete account</h2><p>Account deletion is not enabled yet. A secure server-side account management endpoint is required before deletion can be safely implemented.</p><footer><button onClick={() => setDeleteInfoOpen(false)}>Got it</button></footer></section></div>}
  </section>;
}
