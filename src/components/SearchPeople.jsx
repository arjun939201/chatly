import { useEffect, useState } from "react";
import { useExploreData } from "./explore/useExploreData";
import { Search as SearchIcon, Users, FileText } from "lucide-react";
import { ExploreSearchInput } from "./explore/ExploreSearchControls";
import { PeopleResults, PostResults } from "./explore/ExploreResultSections";

export default function SearchPeople({ session, requestedProfile, onProfileRequestHandled, onOpenProfile, onOpenChats, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState("people");
  const {
    people, posts, peopleLoading, postsLoading, peopleError, postsError,
    peopleHasMore, postsHasMore, loadMorePeople, loadMorePosts
  } = useExploreData(query);
  const hasQuery = Boolean(query.trim());

  useEffect(() => {
    if (!requestedProfile) return;
    onOpenProfile?.(requestedProfile);
    onProfileRequestHandled?.();
  }, [requestedProfile, onOpenProfile, onProfileRequestHandled]);

  function openProfile(person) {
    if (person?.id) onOpenProfile?.(person);
  }

  return <main className="search-page">
    <section className="search-people dedicated-search-page">
      <div className="explore-home-heading">
        <span className="explore-home-icon"><SearchIcon size={21} /></span>
        <div><h2>Search Chatly</h2><p>Find people to connect with and posts worth reading.</p></div>
      </div>
      <ExploreSearchInput query={query} onQueryChange={setQuery} />
      <div className="dedicated-search-tabs" role="tablist" aria-label="Search categories">
        <button type="button" role="tab" id="explore-tab-people" aria-selected={kind === "people"} className={kind === "people" ? "active" : ""} onClick={() => setKind("people")}><Users size={16}/> People</button>
        <button type="button" role="tab" id="explore-tab-posts" aria-selected={kind === "posts"} className={kind === "posts" ? "active" : ""} onClick={() => setKind("posts")}><FileText size={16}/> Posts</button>
      </div>
      {!hasQuery ? <div className="dedicated-search-empty"><SearchIcon size={24}/><h3>What are you looking for?</h3><p>Enter a name, username, or words from a post above.</p></div>
      : <div id="explore-results" role="tabpanel" aria-labelledby={`explore-tab-${kind}`}>
        {kind === "people" ? <PeopleResults people={people} loading={peopleLoading} error={peopleError} hasMore={peopleHasMore} onLoadMore={loadMorePeople} currentUserId={session?.user?.id} onOpenProfile={openProfile} onOpenChats={onOpenChats} />
        : <PostResults posts={posts} loading={postsLoading} error={postsError} hasMore={postsHasMore} onLoadMore={loadMorePosts} onOpenProfile={openProfile} query={query} />}
      </div>}
    </section>
  </main>;
}
