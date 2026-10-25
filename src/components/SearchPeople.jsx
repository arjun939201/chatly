import { useEffect, useState } from "react";
import { useExploreData } from "./explore/useExploreData";
import { useYouTubeSearch } from "./explore/useYouTubeSearch";
import { Compass } from "lucide-react";
import ExploreHome from "./explore/ExploreHome";
import { ExploreCategoryTabs, ExploreSearchInput } from "./explore/ExploreSearchControls";
import { PeopleResults, PostResults, RoomsResults, YouTubeResults } from "./explore/ExploreResultSections";

export default function SearchPeople({ session, requestedProfile, onProfileRequestHandled, onOpenProfile, onOpenChats, onPlayVideo }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const {
    people, posts, peopleLoading, postsLoading, peopleError, postsError,
    peopleHasMore, postsHasMore, loadMorePeople, loadMorePosts
  } = useExploreData(query);
  const { videos, loading: videoLoading, error: videoError } = useYouTubeSearch(query, kind);
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
    <section className="search-people">
      <div className="explore-home-heading">
        <span className="explore-home-icon"><Compass size={21} /></span>
        <div><h2>Discover on Chatly</h2><p>Find conversations and people beyond your feed.</p></div>
      </div>
      <ExploreSearchInput query={query} onQueryChange={setQuery} />
      {hasQuery ? <ExploreCategoryTabs activeCategory={kind} onCategoryChange={setKind} /> : <ExploreHome onSearch={topic => { setKind("all"); setQuery(topic); }} />}

      {hasQuery && <div id="explore-results" role="tabpanel" aria-labelledby={`explore-tab-${kind}`}>
        {(kind === "all" || kind === "people") && <PeopleResults
          people={people}
          loading={peopleLoading}
          error={peopleError}
          hasMore={peopleHasMore}
          onLoadMore={loadMorePeople}
          currentUserId={session?.user?.id}
          onOpenProfile={openProfile}
          onOpenChats={onOpenChats}
        />}
        {(kind === "all" || kind === "posts") && <PostResults
          posts={posts}
          loading={postsLoading}
          error={postsError}
          hasMore={postsHasMore}
          onLoadMore={loadMorePosts}
          onOpenProfile={openProfile}
          query={query}
        />}
        {kind === "rooms" && <RoomsResults />}
        {kind === "songs" && <YouTubeResults videos={videos} loading={videoLoading} error={videoError} onPlayVideo={onPlayVideo} />}
      </div>}
    </section>
  </main>;
}
