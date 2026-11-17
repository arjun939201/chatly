import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CheckCircle2, FileText, Flag, LayoutDashboard, LoaderCircle, LockKeyhole, Search, Shield, ShieldAlert, ShieldCheck, Trash2, UserRound, UserX, Users } from "lucide-react";
import { supabase } from "../lib/supabase";

const sections = [
  ["overview", "Overview", LayoutDashboard],
  ["users", "Users", Users],
  ["posts", "Posts", FileText],
  ["comments", "Comments", FileText],
  ["reports", "Reports", Flag],
  ["staff", "Staff & roles", ShieldCheck],
  ["audit", "Audit log", Activity]
];
const roleNames = { owner: "Owner", super_admin: "Super admin", admin: "Admin", moderator: "Moderator", support: "Support" };
const dateLabel = value => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const personInitial = person => (person?.display_name || person?.username || "C").slice(0, 1).toUpperCase();

export default function AdminDashboard({ session, onBack }) {
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [staff, setStaff] = useState([]);
  const [audit, setAudit] = useState([]);
  const [counts, setCounts] = useState({ users: 0, posts: 0, reports: 0, staff: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [staffId, setStaffId] = useState("");
  const [staffRole, setStaffRole] = useState("moderator");
  const [permissions, setPermissions] = useState("posts.read, posts.delete, reports.read");

  const can = useCallback(permission => role?.role === "owner" || role?.permissions?.includes("*") || role?.permissions?.includes(permission), [role]);

  const loadRole = useCallback(async () => {
    setRoleLoading(true);
    const { data, error: resultError } = await supabase.from("admin_roles").select("role,permissions,is_active").eq("user_id", session.user.id).maybeSingle();
    setRole(resultError || !data?.is_active ? null : data);
    if (resultError) setError(resultError.message);
    setRoleLoading(false);
  }, [session.user.id]);

  const loadData = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    const [u, p, c, r, s, a, restrictions] = await Promise.all([
      supabase.from("profiles").select("id,username,display_name,avatar_url,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
      supabase.from("posts").select("id,user_id,body,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
      supabase.from("post_comments").select("id,post_id,user_id,body,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("post_reports").select("id,post_id,reporter_id,reason,details,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_roles").select("user_id,role,permissions,is_active,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_audit_logs").select("id,actor_id,action,target_type,target_id,details,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_user_restrictions").select("user_id,status,reason,expires_at")
    ]);
    if (u.error) setError(u.error.message);
    else setUsers((u.data || []).map(user => ({ ...user, restriction: (restrictions.data || []).find(item => item.user_id === user.id) || null })));
    if (p.error) setError(p.error.message); else setPosts(p.data || []);
    setComments(c.data || []);
    setReports(r.data || []);
    setStaff(s.data || []);
    setAudit(a.data || []);
    setCounts({ users: u.count || 0, posts: p.count || 0, reports: (r.data || []).length, staff: (s.data || []).length });
    setLoading(false);
  }, [role]);

  useEffect(() => { loadRole(); }, [loadRole]);
  useEffect(() => { if (role) loadData(); }, [role, loadData]);

  const filteredUsers = useMemo(() => {
    const term = query.toLowerCase().trim();
    return users.filter(user => !term || [user.id, user.username, user.display_name].some(value => String(value || "").toLowerCase().includes(term)));
  }, [users, query]);
  const filteredPosts = useMemo(() => {
    const term = query.toLowerCase().trim();
    return posts.filter(post => !term || [post.id, post.user_id, post.body].some(value => String(value || "").toLowerCase().includes(term)));
  }, [posts, query]);

  async function setRestriction(user, status) {
    const reason = status === "active" ? "" : window.prompt("Reason for account restriction", "Community guidelines violation");
    if (status !== "active" && reason === null) return;
    setBusy(user.id); setError(""); setNotice("");
    const result = await supabase.rpc("admin_set_user_restriction", {
      target_user_id: user.id, new_status: status, restriction_reason: reason || "", restriction_expires_at: null
    });
    if (result.error) setError(result.error.message);
    else { setNotice(status === "active" ? "Account restored." : "Account restricted."); await loadData(); }
    setBusy("");
  }

  async function removePost(post) {
    if (!window.confirm("Permanently delete this post? This cannot be undone.")) return;
    setBusy(String(post.id)); setError(""); setNotice("");
    const result = await supabase.rpc("admin_delete_post", { target_post_id: post.id });
    if (result.error) setError(result.error.message);
    else { setNotice("Post deleted and recorded."); await loadData(); }
    setBusy("");
  }

  async function removeComment(comment) {
    if (!window.confirm("Permanently delete this comment?")) return;
    setBusy("comment-" + comment.id); setError(""); setNotice("");
    const result = await supabase.rpc("admin_delete_comment", { target_comment_id: comment.id });
    if (result.error) setError(result.error.message);
    else { setNotice("Comment deleted and recorded."); await loadData(); }
    setBusy("");
  }

  async function saveStaff(event) {
    event.preventDefault();
    setBusy("staff"); setError(""); setNotice("");
    const result = await supabase.rpc("admin_assign_role", {
      target_user_id: staffId.trim(), new_role: staffRole,
      new_permissions: permissions.split(",").map(value => value.trim()).filter(Boolean)
    });
    if (result.error) setError(result.error.message);
    else { setNotice("Staff role saved."); setStaffId(""); await loadData(); }
    setBusy("");
  }

  async function removeStaff(userId) {
    if (!window.confirm("Remove this staff role?")) return;
    setBusy(userId); setError(""); setNotice("");
    const result = await supabase.rpc("admin_remove_role", { target_user_id: userId });
    if (result.error) setError(result.error.message);
    else { setNotice("Staff role removed."); await loadData(); }
    setBusy("");
  }

  if (roleLoading) return <main className="admin-gate"><LoaderCircle className="admin-spin"/> Checking administrative access…</main>;
  if (!role) return <main className="admin-gate"><LockKeyhole size={32}/><h1>Access restricted</h1><p>This account does not have an active Chatly administrator role.</p>{error && <p className="admin-error">{error}</p>}<button onClick={onBack}><ArrowLeft size={16}/> Return to Chatly</button></main>;

  const visibleSections = sections.filter(([id]) =>
    id === "overview" || (id === "users" && can("users.read")) || (id === "posts" && can("posts.read")) ||
    (id === "comments" && can("posts.read")) || (id === "reports" && can("reports.read")) ||
    (id === "staff" && can("roles.read")) || (id === "audit" && can("audit.read"))
  );
  const current = sections.find(item => item[0] === section) || sections[0];

  return <main className="chatly-admin">
    <aside className="admin-sidebar">
      <div className="admin-brand"><span><Shield size={19}/></span><b>chatly <i>control</i></b></div>
      <small className="admin-side-label">WORKSPACE</small>
      <nav>{visibleSections.map(([id, label, Icon]) => <button key={id} className={section === id ? "active" : ""} onClick={() => { setSection(id); setQuery(""); }}><Icon size={17}/>{label}{id === "reports" && counts.reports > 0 && <em>{counts.reports}</em>}</button>)}</nav>
      <div className="admin-side-bottom"><span>{roleNames[role.role] || role.role}</span><button onClick={onBack}><ArrowLeft size={16}/> Back to Chatly</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-header"><div><small>CHATLY / CONTROL CENTER</small><h1>{current[1]}</h1></div><div><span>{session.user.email}</span><button title="Refresh" onClick={loadData}><Activity size={17}/></button></div></header>
      {(error || notice) && <div className={"admin-message " + (error ? "error" : "success")} role="status">{error || notice}<button onClick={() => { setError(""); setNotice(""); }}>×</button></div>}

      {section === "overview" && <><div className="admin-welcome"><div><small>PLATFORM OVERVIEW</small><h2>Community at a glance</h2><p>Live totals from the Chatly database.</p></div><span className="admin-live"><i/> Connected</span></div>
        <div className="admin-metrics">{[
          ["Registered users", counts.users, Users], ["Published posts", counts.posts, FileText],
          ["Submitted reports", counts.reports, Flag], ["Staff accounts", counts.staff, ShieldCheck]
        ].map(([label, value, Icon]) => <article key={label}><span><Icon size={19}/></span><small>{label}</small><b>{loading ? "—" : value.toLocaleString()}</b><em>Current database total</em></article>)}</div>
        <div className="admin-panels"><article><h3>Quick access</h3><p>Jump to a management area</p>{visibleSections.filter(item => item[0] !== "overview").map(([id,label,Icon]) => <button key={id} onClick={() => setSection(id)}><Icon size={17}/>{label}<span>›</span></button>)}</article><article><h3>Access level</h3><p>Current administrator permissions</p><div className="admin-access-row"><span>Signed in as</span><b>{session.user.email}</b></div><div className="admin-access-row"><span>Role</span><b>{roleNames[role.role] || role.role}</b></div><div className="admin-access-row"><span>Permissions</span><b>{role.role === "owner" || role.permissions?.includes("*") ? "All" : role.permissions?.length || 0}</b></div><div className="admin-security-note"><ShieldCheck size={16}/> Database policies enforce every protected action.</div></article></div>
      </>}

      {section === "users" && can("users.read") && <article className="admin-panel"><div className="admin-panel-heading"><div><h2>User directory</h2><p>Search accounts and apply restrictions</p></div><b>{filteredUsers.length} results</b></div><div className="admin-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, username or ID"/></div><div className="admin-table-scroll"><table><thead><tr><th>USER</th><th>USER ID</th><th>JOINED</th><th>STATUS</th>{can("users.restrict") && <th>ACTION</th>}</tr></thead><tbody>{filteredUsers.map(user => <tr key={user.id}><td><div className="admin-person"><span>{user.avatar_url ? <img src={user.avatar_url} alt=""/> : personInitial(user)}</span><div><b>{user.display_name || "Chatly user"}</b><small>{user.username ? "@" + user.username : "No username"}</small></div></div></td><td><code>{user.id.slice(0,8)}…</code></td><td>{dateLabel(user.created_at)}</td><td><i className={"admin-status " + (user.restriction ? "restricted" : "active")}>{user.restriction?.status || "Active"}</i></td>{can("users.restrict") && <td><button className="admin-action" disabled={busy === user.id || user.id === session.user.id} onClick={() => setRestriction(user, user.restriction ? "active" : "suspended")}>{busy === user.id ? "Working…" : user.restriction ? "Restore" : "Suspend"}</button></td>}</tr>)}{!filteredUsers.length && <tr><td colSpan={5}>No matching users.</td></tr>}</tbody></table></div><p className="admin-footnote">Showing up to 100 recently registered accounts. Private authentication data and email addresses are not exposed.</p></article>}

      {section === "posts" && can("posts.read") && <article className="admin-panel"><div className="admin-panel-heading"><div><h2>Post management</h2><p>Review and moderate published posts</p></div><b>{filteredPosts.length} results</b></div><div className="admin-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search post text or author ID"/></div>{filteredPosts.map(post => <div className="admin-content-row" key={post.id}><div><b>Post #{post.id}</b><small>{dateLabel(post.created_at)} · Author {post.user_id.slice(0,8)}…</small><p>{post.body}</p></div>{can("posts.delete") && <button title="Delete post" disabled={busy === String(post.id)} onClick={() => removePost(post)}><Trash2 size={17}/></button>}</div>)}{!filteredPosts.length && <p className="admin-empty">No matching posts.</p>}</article>}

      {section === "comments" && can("posts.read") && <article className="admin-panel"><div className="admin-panel-heading"><div><h2>Comment management</h2><p>Review comments across the community</p></div><b>{comments.length} recent</b></div>{comments.map(comment => <div className="admin-content-row" key={comment.id}><div><b>Comment #{comment.id} · Post #{comment.post_id}</b><small>{dateLabel(comment.created_at)} · Author {comment.user_id.slice(0,8)}…</small><p>{comment.body}</p></div>{can("posts.delete") && <button title="Delete comment" disabled={busy === "comment-" + comment.id} onClick={() => removeComment(comment)}><Trash2 size={17}/></button>}</div>)}{!comments.length && <p className="admin-empty">No comments found.</p>}</article>}

      {section === "reports" && can("reports.read") && <article className="admin-panel"><div className="admin-panel-heading"><div><h2>Report queue</h2><p>Review reports submitted by users</p></div><b>{reports.length} reports</b></div>{reports.map(report => <div className="admin-content-row report" key={report.id}><div><b>{report.reason.replaceAll("_"," ")}</b><small>Post #{report.post_id} · {dateLabel(report.created_at)}</small><p>{report.details || "No additional details supplied."}</p><small>Reporter ID: {report.reporter_id}</small></div></div>)}{!reports.length && <p className="admin-empty">No reports in the queue.</p>}</article>}

      {section === "staff" && can("roles.read") && <div className="admin-staff-layout">{can("roles.manage") && <form className="admin-panel admin-staff-form" onSubmit={saveStaff}><h2>Assign staff access</h2><p>Enter the exact Supabase Auth user UUID.</p><label>User UUID<input value={staffId} onChange={event => setStaffId(event.target.value)} required pattern="[0-9a-fA-F-]{36}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/></label><label>Role<select value={staffRole} onChange={event => setStaffRole(event.target.value)}>{Object.entries(roleNames).filter(([key]) => key !== "owner" || role.role === "owner").map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>Permissions<textarea rows={3} value={permissions} onChange={event => setPermissions(event.target.value)} placeholder="users.read, posts.read"/></label><button disabled={busy === "staff"}>{busy === "staff" ? "Saving…" : "Save role"}</button><small>Only the owner can grant or modify an owner role.</small></form>}<article className="admin-panel"><div className="admin-panel-heading"><div><h2>Staff directory</h2><p>Administrative accounts and access</p></div><b>{staff.length}</b></div>{staff.map(member => <div className="admin-content-row" key={member.user_id}><div><b>{roleNames[member.role] || member.role}</b><small>{member.user_id}</small><small>{member.permissions?.length || 0} permissions · {member.is_active ? "Active" : "Disabled"}</small></div>{can("roles.manage") && member.role !== "owner" && member.user_id !== session.user.id && <button onClick={() => removeStaff(member.user_id)}><UserX size={17}/></button>}</div>)}</article></div>}

      {section === "audit" && can("audit.read") && <article className="admin-panel"><div className="admin-panel-heading"><div><h2>Administrative activity</h2><p>Recent actions by owners and staff</p></div><b>{audit.length} events</b></div>{audit.map(entry => <div className="admin-content-row" key={entry.id}><div><b>{entry.action.replaceAll("."," ")}</b><small>{entry.target_type} · {entry.target_id || "—"}</small><small>{dateLabel(entry.created_at)} · Actor {entry.actor_id || "System"}</small></div></div>)}{!audit.length && <p className="admin-empty">No administrative events yet.</p>}</article>}

      {loading && <div className="admin-loading"><LoaderCircle className="admin-spin" size={16}/> Refreshing database data…</div>}
      <footer className="admin-footer">Chatly Control Center · Protected administration workspace</footer>
    </section>
  </main>;
}
