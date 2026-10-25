import { useState } from "react";
import { MessageCircle, Chrome, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";

const authRedirectUrl = () => import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [verificationPending, setVerificationPending] = useState(false);

  const isSignup = mode === "signup";
  function showMessage(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }
  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setVerificationPending(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  async function googleSignIn() {
    if (busy || !supabase) return;
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

  async function submitEmailAuth(event) {
    event.preventDefault();
    if (busy || !supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (isSignup) {
      if (!displayName.trim()) return showMessage("Enter your name.", "error");
      if (displayName.trim().length > 40) return showMessage("Name must be 40 characters or fewer.", "error");
      const normalizedUsername = username.trim().toLowerCase();
      if (normalizedUsername && !/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
        return showMessage("Username must be 3–20 characters using letters, numbers, or underscores.", "error");
      }
      if (password.length < 6) return showMessage("Password must be at least 6 characters.", "error");
      if (password !== confirmPassword) return showMessage("Passwords do not match.", "error");
    }
    setBusy(true);
    showMessage("");
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: authRedirectUrl(),
            data: {
              display_name: displayName.trim(),
              username: username.trim().toLowerCase() || null
            }
          }
        });
        if (error) throw error;
        if (!data.session) {
          setVerificationPending(true);
          showMessage("Your account was created. Check your email to confirm your address, then sign in.", "success");
        } else {
          showMessage("Account created successfully.", "success");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (error) throw error;
      }
    } catch (error) {
      showMessage(error.message || (isSignup ? "Could not create your account." : "Could not sign in. Please try again."), "error");
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
      <div className="auth-heading">
        <h1>{verificationPending ? "Check your inbox" : isSignup ? "Create your account" : "Welcome back"}</h1>
        <p>{verificationPending ? "Confirm your email address to finish creating your Chatly account." : isSignup ? "Join the conversation and connect with people." : "Sign in to continue to your conversations."}</p>
      </div>
      {!verificationPending && <>
        <button type="button" className="oauth-button" onClick={googleSignIn} disabled={busy}>
          <Chrome size={18}/> {busy ? "Connecting…" : "Continue with Google"}
        </button>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form onSubmit={submitEmailAuth} className="auth-traditional-form">
          {isSignup && <>
            <label>Full name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={40} required/></label>
            <label>Username <span className="field-hint">Optional · can be set later</span><input value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" autoComplete="username" maxLength={20}/></label>
          </>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>
          <label>Password
            <span className="auth-password-field">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignup ? "At least 6 characters" : "Your password"} autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 6 : undefined} required/>
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
            </span>
          </label>
          {isSignup && <label>Confirm password<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" minLength={6} required/></label>}
          {!isSignup && <button type="button" className="auth-switch-link auth-forgot-link" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
          <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</button>
        </form>
        <p className="auth-legal">{isSignup ? "By creating an account, you agree to use Chatly respectfully." : "Your conversations belong to you."}</p>
      </>}
      {verificationPending && <button className="primary-button" onClick={() => switchMode("login")}>Back to sign in</button>}
      {!verificationPending && <p className="auth-mode-switch">
        {isSignup ? "Already have an account? " : "New to Chatly? "}
        <button type="button" className="auth-switch-link" onClick={() => switchMode(isSignup ? "login" : "signup")}>{isSignup ? "Sign in" : "Create account"}</button>
      </p>}
      {message && <p className={`form-message auth-message-${messageType}`} role="status" aria-live="polite">{message}</p>}
    </section>
  </main>;
}
