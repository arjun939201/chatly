import { ChevronLeft } from "lucide-react";

export default function SettingsDestination({effectiveTheme,setTheme,fontSize,setFontSize,fontFamily,setFontFamily,fontSizeExpanded,setFontSizeExpanded,fontFamilyExpanded,setFontFamilyExpanded,accountInfoExpanded,setAccountInfoExpanded,editProfileOpen,setEditProfileOpen,setNotice,notice,session,emailExpanded,setEmailExpanded,accountEmail,setAccountEmail,supabase,passwordExpanded,setPasswordExpanded,password,setPassword,setNewPassword,settingsExpanded,setSettingsExpanded,chatPrefs,setChatPrefs}) {
  return (
    <section className="destination-page settings-page app-settings-destination-page">
      
      <section className="settings-section app-style-controls">
        <div className="settings-view-heading"><h3>Appearance</h3><button type="button" className={effectiveTheme === "dark" ? "theme-switch on" : "theme-switch"} role="switch" aria-checked={effectiveTheme === "dark"} aria-label="Toggle theme" onClick={() => setTheme(effectiveTheme === "dark" ? "light" : "dark")}><span/></button></div>
        <button className="style-expander" onClick={() => {setFontSizeExpanded(v => !v); setFontFamilyExpanded(v => !v)}}><span>Fonts</span><span>{fontSizeExpanded || fontFamilyExpanded ? "−" : "+"}</span></button>
        {(fontSizeExpanded || fontFamilyExpanded) && <>
          <div className="font-setting-group"><span>Font size</span><div className="style-choice-row">{["small","medium","large"].map(value => <button key={value} className={fontSize === value ? "selected" : ""} onClick={() => setFontSize(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></div>
          <div className="font-setting-group"><span>Font family</span><div className="style-choice-row">{[{value:"system",label:"System"},{value:"sans",label:"Sans"},{value:"serif",label:"Serif"}].map(item => <button key={item.value} className={fontFamily === item.value ? "selected" : ""} onClick={() => setFontFamily(item.value)}>{item.label}</button>)}</div></div>
        </>}
        <h3 className="settings-category-label">ACCOUNT & SECURITY</h3>
        <button className="style-expander" onClick={() => setAccountInfoExpanded(v => !v)}><span>Account settings</span><span>{accountInfoExpanded ? "−" : "+"}</span></button>
        {accountInfoExpanded && <div className="account-settings-inline">
          <header className="settings-subpage-header"><button type="button" aria-label="Close account settings" onClick={() => setAccountInfoExpanded(false)}><ChevronLeft size={22}/></button><h2>Account & sign-in</h2></header>
          <div className="settings-section account-view">
            <h3 className="account-options-label">PERSONAL INFORMATION</h3>
            <button className="style-expander account-option-row" onClick={() => { setEditProfileOpen(true); setNotice(""); }}><span><strong>Personal information</strong><small>Display name, username, profile photo and bio</small></span><span>›</span></button>
            <button className="style-expander account-option-row" onClick={() => setEmailExpanded(v => !v)}><span><strong>Email address</strong><small>{session.user.email || "Manage your sign-in email"}</small></span><span>{emailExpanded ? "−" : "+"}</span></button>
            {emailExpanded && <form className="password-form" onSubmit={async event => { event.preventDefault(); setNotice(""); const { error } = await supabase.auth.updateUser({ email: accountEmail.trim() }); setNotice(error ? error.message : "Email update requested. Check your inbox to confirm the change."); }}><label>New email address<input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} placeholder="name@example.com" required/></label><button className="secondary-button" disabled={!accountEmail.trim() || accountEmail.trim() === session.user.email}>Update email</button></form>}
            <h3 className="account-options-label">SECURITY & SIGN-IN</h3>
            <button className="style-expander account-option-row" onClick={() => setPasswordExpanded(v => !v)}><span><strong>Change password</strong><small>Choose a new password for your account</small></span><span>{passwordExpanded ? "−" : "+"}</span></button>
            {passwordExpanded && <form className="password-form" onSubmit={setNewPassword}><label>New password<input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required/></label><button className="secondary-button" disabled={!password}>Update password</button></form>}
            <button className="style-expander account-option-row" onClick={() => { if (window.confirm("Sign out of Chatly on all devices?")) supabase.auth.signOut({ scope: "global" }); }}><span><strong>Active sessions</strong><small>Sign out from all devices</small></span><span>›</span></button>
            <h3 className="account-options-label">ACCOUNT MANAGEMENT</h3>
            <button className="style-expander account-option-row" onClick={() => setNotice("Account deactivation needs a secure server-side account management endpoint before it can be enabled.")}><span><strong>Deactivate account</strong><small>Temporarily disable your account</small></span><span>›</span></button>
            <button className="style-expander account-option-row account-danger-option" onClick={() => setNotice("Account deletion needs a secure server-side account management endpoint before it can be enabled.")}><span><strong>Delete account</strong><small>Permanently remove your account and data</small></span><span>›</span></button>
            <button className="style-expander account-option-row" onClick={() => supabase.auth.signOut()}><span><strong>Log out</strong><small>Sign out of this device</small></span><span>›</span></button>
          </div>
          {notice && <p className="form-message">{notice}</p>}
        </div>}
        <h3 className="settings-category-label">CHAT PREFERENCES</h3>
        <button className="style-expander" onClick={() => setSettingsExpanded(v => ({...v, chats: !v.chats}))}><span>Chats</span><span>{settingsExpanded.chats ? "−" : "+"}</span></button>
        {settingsExpanded.chats && <div className="settings-options-panel">
          <label className="settings-toggle-row"><span><strong>Enter to send</strong><small>Send messages with the Enter key</small></span><input type="checkbox" checked={chatPrefs.enterToSend} onChange={e => setChatPrefs(p => ({...p, enterToSend:e.target.checked}))}/></label>
          <label className="settings-toggle-row"><span><strong>Media previews</strong><small>Show previews for shared media when available</small></span><input type="checkbox" checked={chatPrefs.mediaPreview} onChange={e => setChatPrefs(p => ({...p, mediaPreview:e.target.checked}))}/></label>
        </div>}
        <h3 className="settings-category-label">NOTIFICATIONS</h3>
        <button className="style-expander" onClick={() => setSettingsExpanded(v => ({...v, notifications: !v.notifications}))}><span>Notification preferences</span><span>{settingsExpanded.notifications ? "−" : "+"}</span></button>
        {settingsExpanded.notifications && <div className="settings-options-panel">
          <label className="settings-toggle-row"><span><strong>Message alerts</strong><small>Allow in-app message alerts</small></span><input type="checkbox" checked={chatPrefs.messageAlerts} onChange={e => setChatPrefs(p => ({...p, messageAlerts:e.target.checked}))}/></label>
          <label className="settings-toggle-row"><span><strong>Activity alerts</strong><small>Allow activity and community alerts</small></span><input type="checkbox" checked={chatPrefs.activityAlerts} onChange={e => setChatPrefs(p => ({...p, activityAlerts:e.target.checked}))}/></label>
        </div>}
        <h3 className="settings-category-label">PRIVACY</h3>
        <button className="style-expander" onClick={() => setSettingsExpanded(v => ({...v, privacy: !v.privacy}))}><span>Privacy preferences</span><span>{settingsExpanded.privacy ? "−" : "+"}</span></button>
        {settingsExpanded.privacy && <div className="settings-options-panel">
          <label className="settings-toggle-row"><span><strong>Read receipts</strong><small>Preference saved locally; server enforcement requires backend support</small></span><input type="checkbox" checked={chatPrefs.readReceipts} onChange={e => setChatPrefs(p => ({...p, readReceipts:e.target.checked}))}/></label>
          <p className="settings-note">Preferences are stored on this device. Server-enforced privacy controls need matching backend support.</p>
        </div>}
      </section>
    </section>
  );
}
