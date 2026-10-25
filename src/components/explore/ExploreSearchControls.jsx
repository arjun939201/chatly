import { Search, X } from "lucide-react";

export function ExploreSearchInput({ query, onQueryChange }) {
  return <label className="search-page-input">
    <Search size={18} aria-hidden="true" />
    <input
      value={query}
      onChange={event => onQueryChange(event.target.value)}
      placeholder="Search people, posts, and music…"
      aria-label="Search Explore"
      autoComplete="off"
      enterKeyHint="search"
    />
    {query && <button type="button" className="search-clear-button" onClick={() => onQueryChange("")} aria-label="Clear search"><X size={17} /></button>}
  </label>;
}

export function ExploreCategoryTabs({ activeCategory, onCategoryChange }) {
  return <div className="search-kind-tabs" role="tablist" aria-label="Explore categories">
    {["all", "people", "posts", "rooms", "songs"].map(category => <button
      type="button"
      role="tab"
      key={category}
      id={`explore-tab-${category}`}
      aria-selected={activeCategory === category}
      aria-controls="explore-results"
      tabIndex={activeCategory === category ? 0 : -1}
      className={activeCategory === category ? "active" : ""}
      onClick={() => onCategoryChange(category)}
    >
      {category === "all" ? "Everything" : category === "songs" ? "Music" : category[0].toUpperCase() + category.slice(1)}
    </button>)}
  </div>;
}

export function ExploreSearchPrompt() {
  return <div className="search-start-prompt">
    <Search size={24} />
    <strong>Search anything on Chatly</strong>
    <p>Search profiles by name or username, explore public posts, and find music videos on YouTube. Rooms discovery is coming soon.</p>
  </div>;
}
