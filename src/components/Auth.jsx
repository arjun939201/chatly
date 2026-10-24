import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "register") {
        const cleanUsername = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
          setMessage("Username must be 3–20 characters: letters, numbers, or underscores.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: cleanUsername, display_name: displayName.trim() || cleanUsername } }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
        } else {
          setMessage("Account created. You're ready to chat!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span className="brand-mark"><MessageCircle size={22} /></span><span>Chatly</span></div>
      <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="muted">{mode === "login" ? "Sign in to continue your conversations." : "Find friends and start chatting."}</p>
      <form onSubmit={submit}>
        {mode === "register" && <>
          <label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={40} /></label>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. alex_12" required /></label>
        </>}
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required placeholder="At least 6 characters" /></label>
        <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      {message && <p className="form-message">{message}</p>}
      <p className="switch-mode">{mode === "login" ? "New to Chatly?" : "Already have an account?"}
        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
          {mode === "login" ? "Create account" : "Sign in"}
        </button>
      </p>
    </section>
  </main>;
}