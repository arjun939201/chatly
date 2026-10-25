import { useEffect, useState } from "react";
import { useExploreData } from "./explore/useExploreData";
import { useYouTubeSearch } from "./explore/useYouTubeSearch";
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
      <h1>Explore</h1>
      <p>Discover people, rooms, posts, and songs.</p>
      <ExploreSearchInput query={query} onQueryChange={setQuery} />
      {hasQuery ? <ExploreCategoryTabs activeCategory={kind} onCategoryChange={setKind} /> : <ExploreHome onSearch={category => { setKind(category); setQuery(category); }} />}

      {hasQuery && <>
        {(kind === "all" || kind === "people") && <PeopleResults
          people={people}
          loading={peopleLoading}
          error={peopleError}
          hasMore={peopleHasMore}
          onLoadMore={loadMorePeople}
          currentUserId={session.user.id}
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
      </>}
    </section>
  </main>;
}
