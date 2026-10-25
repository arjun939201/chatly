import { useEffect, useState } from "react";
import { Search, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
export default function SearchPeople({ session, onOpenChats }) {
 const [query,setQuery]=useState(""); const [people,setPeople]=useState([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true; supabase.from("profiles").select("id,username,display_name,avatar_url").neq("id",session.user.id).order("display_name").limit(100).then(({data})=>{if(active){setPeople(data||[]);setLoading(false);}});return()=>{active=false};},[session.user.id]);
 const results=people.filter(p=>`${p.display_name||""} ${p.username||""}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <main className="search-page"><section className="search-people"><h1>Search</h1><p>Find people on Chatly.</p><label className="search-page-input"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or username"/></label><div className="search-results">{loading?<p>Loading people…</p>:results.length?results.map(p=><article className="search-person" key={p.id}><span className="mini-avatar">{p.avatar_url?<img src={p.avatar_url} alt=""/>:(p.display_name||"?").slice(0,1).toUpperCase()}</span><span><b>{p.display_name||"Chatly user"}</b><small>{p.username?"@"+p.username:"Chatly member"}</small></span><button onClick={onOpenChats} aria-label="Open chats"><MessageCircle size={17}/></button></article>):<p>No people found.</p>}</div></section></main>;
}