import { useState } from "react";
import { MessageCircle, Mail, Chrome, ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "../lib/supabase";

const authRedirectUrl = () => import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

export default function Auth() {
  const [mode, setMode] = useState("start");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [sent, setSent] = useState(false);

  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  async function googleSignIn() {
    if (busy) return;
    setBusy(true);
    showMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirectUrl() }
      });
      if (error) throw error;
    } catch (error) {
      showMessage(error.message || "Google sign-in could not be started. Please try again.", "error");
      setBusy(false);
    }
  }

  async function emailSignIn(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    showMessage("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (usePassword) {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: authRedirectUrl(),
            shouldCreateUser: true,
            data: { display_name: displayName.trim() || normalizedEmail.split("@")[0] }
          }
        });
        if (error) throw error;
        setSent(true);
        showMessage("If an account can be signed in with this email, a secure link is on its way. Check your inbox and spam folder.", "success");
      }
    } catch (error) {
      showMessage(error.message || "Could not sign in. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resendLink() {
    if (busy || !email.trim()) return;
    setBusy(true);
    showMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: authRedirectUrl(),
          shouldCreateUser: true,
          data: { display_name: displayName.trim() || email.trim().split("@")[0] }
        }
      });
      if (error) throw error;
      showMessage("A new sign-in link has been requested. Check your inbox and spam folder.", "success");
    } catch (error) {
      showMessage(error.message || "Could not resend the sign-in link.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (busy || !email.trim()) {
      showMessage("Enter your email address first.", "error");
      return;
    }
    setBusy(true);
    showMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: authRedirectUrl()
      });
      if (error) throw error;
      showMessage("If an account exists for this email, password recovery instructions have been sent.", "success");
    } catch (error) {
      showMessage(error.message || "Could not request password recovery.", "error");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-card auth-card-modern">
      <div className="auth-brand"><span className="brand-mark"><MessageCircle size={22}/></span><span>Chatly</span></div>
      {mode === "start" ? <>
        <div className="auth-heading"><h1>Conversations start here.</h1><p>Connect with people, simply and securely.</p></div>
        <button className="oauth-button" onClick={googleSignIn} disabled={busy}><Chrome size={18}/> {busy ? "Connecting…" : "Continue with Google"}</button>
        <div className="auth-divider"><span>or</span></div>
        <button className="primary-button auth-email-button" onClick={() => { setMode("email"); setSent(false); showMessage(""); }}><Mail size={17}/> Continue with email</button>
        <p className="auth-legal">By continuing, you agree to use Chatly respectfully.</p>
      </> : <>
        <button className="back-button" onClick={() => { setMode("start"); setMessage(""); setUsePassword(false); setPassword(""); }}><ArrowLeft size={16}/> Back</button>
        <h1>{sent ? "Check your inbox" : usePassword ? "Sign in with password" : "Continue with email"}</h1>
        <p className="muted">{sent ? "Use the secure link we sent you to sign in to Chatly." : usePassword ? "Sign in with the password associated with your account." : "We'll email you a secure sign-in link. No password needed."}</p>
        {!sent && <form onSubmit={emailSignIn}>
          {!usePassword && <label>Your name <span className="field-hint">Optional for existing accounts</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={40}/></label>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>
          {usePassword && <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Your password" autoComplete="current-password"/></label>}
          <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : usePassword ? "Sign in" : "Send sign-in link"}</button>
        </form>}
        {usePassword && !sent && <button type="button" className="auth-switch-link" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
        {sent && <div className="auth-email-actions">
          <button className="secondary-button" onClick={resendLink} disabled={busy}>{busy ? "Please wait…" : "Resend sign-in link"}</button>
          <button className="auth-switch-link" onClick={() => { setSent(false); showMessage(""); }}>Use another email</button>
        </div>}
        {!sent && <button className="auth-switch-link" onClick={() => { setUsePassword(v => !v); setMessage(""); setPassword(""); }}>{usePassword ? <><Mail size={14}/> Use email sign-in link instead</> : <><KeyRound size={14}/> Already have a password? Sign in with password</>}</button>}
      </>}
      {message && <p className={`form-message auth-message-${messageType}`} role="status" aria-live="polite">{message}</p>}
    </section>
  </main>;
}