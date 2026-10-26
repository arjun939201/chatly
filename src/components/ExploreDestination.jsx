import { Compass, Search } from "lucide-react";
import ExploreHome from "./explore/ExploreHome";

export default function ExploreDestination({ onOpenSearch }) {
  return <main className="search-page explore-destination-page">
    <section className="search-people">
      <div className="explore-home-heading">
        <span className="explore-home-icon"><Compass size={21} /></span>
        <div><h2>Explore Chatly</h2><p>Discover fresh conversations, topics, and communities.</p></div>
      </div>
      <button type="button" className="explore-open-search" onClick={() => onOpenSearch?.()}><Search size={18}/><span>Search people and posts</span></button>
      <ExploreHome onSearch={topic => onOpenSearch?.(topic)} />
    </section>
  </main>;
}
