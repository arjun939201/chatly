import ExploreHome from "./explore/ExploreHome";

export default function ExploreDestination({ onOpenSearch, onPlayVideo }) {
  return <main className="search-page explore-destination-page">
    <ExploreHome onSearch={topic => onOpenSearch?.(topic)} onPlayVideo={onPlayVideo} />
  </main>;
}
