import { useEffect, useState } from "react";
import { MessageCircle, LogOut } from "lucide-react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import Chat from "./components/Chat.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setConfigError(true);
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(data || null);
    }
    loadProfile();
  }, [session]);

  if (configError) {
    return <main className="setup-screen"><div className="setup-card">
      <MessageCircle size={38} /><h1>Set up Chatly</h1>
      <p>Add your Supabase project URL and public anon key to <code>.env.local</code> using <code>.env.example</code>, then restart the dev server.</p>
    </div></main>;
  }
  if (loading) return <main className="loading">Loading Chatly…</main>;
  if (!session) return <Auth />;
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><MessageCircle size={20} /></span> Chatly</div>
      <div className="account"><span>{profile?.display_name || session.user.email}</span>
        <button className="icon-button" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>
      </div>
    </header>
    <Chat session={session} profile={profile} />
  </div>;
}