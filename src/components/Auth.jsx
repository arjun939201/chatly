import { useState } from "react";
import { MessageCircle, Mail, Chrome, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("start");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function googleSignIn() {
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error) { setMessage(error.message); setBusy(false); }
  }

  async function emailSignIn(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
          data: { display_name: displayName.trim() || email.split("@")[0] }
        }
      });
      if (error) throw error;
      setSent(true);
      setMessage("Check your email for your secure sign-in link.");
    } catch (error) { setMessage(error.message || "Could not send the email."); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen">
    <section className="auth-card auth-card-modern">
      <div className="auth-brand"><span className="brand-mark"><MessageCircle size={22}/></span><span>Chatly</span></div>
      {mode === "start" ? <>
        <div className="auth-heading"><h1>Conversations start here.</h1><p>Connect with people, simply and securely.</p></div>
        <button className="oauth-button" onClick={googleSignIn} disabled={busy}><Chrome size={18}/> Continue with Google</button>
        <div className="auth-divider"><span>or</span></div>
        <button className="primary-button auth-email-button" onClick={() => { setMode("email"); setSent(false); setMessage(""); }}><Mail size={17}/> Continue with email</button>
        <p className="auth-legal">By continuing, you agree to use Chatly respectfully.</p>
      </> : <>
        <button className="back-button" onClick={() => { setMode("start"); setMessage(""); }}><ArrowLeft size={16}/> Back</button>
        <h1>{sent ? "Check your inbox" : "Continue with email"}</h1>
        <p className="muted">{sent ? "Use the secure link we sent you to sign in to Chatly." : "We'll email you a secure sign-in link. No password needed."}</p>
        {!sent && <form onSubmit={emailSignIn}>
          <label>Your name <span className="field-hint">Optional for existing accounts</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={40}/></label>
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required/></label>
          <button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Send sign-in link"}</button>
        </form>}
        {sent && <button className="secondary-button" onClick={() => { setSent(false); setMessage(""); }}>Use another email</button>}
      </>}
      {message && <p className="form-message">{message}</p>}
    </section>
  </main>;
}