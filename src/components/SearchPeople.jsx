import { useEffect, useState } from "react";
import { useExploreData } from "./explore/useExploreData";
import { useYouTubeSearch } from "./explore/useYouTubeSearch";
import { ExploreCategoryTabs, ExploreSearchInput, ExploreSearchPrompt } from "./explore/ExploreSearchControls";
import { PeopleResults, PostResults, RoomsResults, YouTubeResults } from "./explore/ExploreResultSections";

export default function SearchPeople({ session, requestedProfile, onProfileRequestHandled, onOpenProfile, onOpenChats, onPlayVideo }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const { people, posts, loading, peopleError, postsError } = useExploreData();
  const { peopleResults, postResults } = useExploreResults(people, posts, query);
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
      {hasQuery ? <ExploreCategoryTabs activeCategory={kind} onCategoryChange={setKind} /> : <ExploreSearchPrompt />}

      {hasQuery && <>
        {(kind === "all" || kind === "people") && <PeopleResults
          people={peopleResults}
          loading={loading}
          error={peopleError}
          currentUserId={session.user.id}
          onOpenProfile={openProfile}
          onOpenChats={onOpenChats}
        />}
        {(kind === "all" || kind === "posts") && <PostResults
          posts={postResults}
          loading={loading}
          error={postsError}
          onOpenProfile={openProfile}
        />}
        {kind === "rooms" && <RoomsResults />}
        {kind === "songs" && <YouTubeResults videos={videos} loading={videoLoading} error={videoError} onPlayVideo={onPlayVideo} />}
      </>}
    </section>
  </main>;
}
