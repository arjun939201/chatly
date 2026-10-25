import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const PAGE_SIZE = 20;

function escapeSearch(value) {
  return String(value || "").trim().replace(/\\/g, "\\\\").replace(/[,%_()]/g, character => `\\${character}`);
}

export function useExploreData(query) {
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [postsError, setPostsError] = useState("");
  const [peopleHasMore, setPeopleHasMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const peopleOffset = useRef(0);
  const postsOffset = useRef(0);
  const requestId = useRef(0);
  const normalizedQuery = query.trim();

  const loadPeople = useCallback(async (append = false, request = requestId.current) => {
    if (!normalizedQuery) return;
    setPeopleLoading(true);
    setPeopleError("");
    const search = escapeSearch(normalizedQuery);
    const from = append ? peopleOffset.current : 0;
    const to = from + PAGE_SIZE - 1;
    const result = await supabase.from("profiles")
      .select("id,username,display_name,avatar_url,bio")
      .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
      .order("display_name")
      .range(from, to);
    if (request !== requestId.current) return;
    if (result.error) {
      setPeopleError("People could not be loaded. Please try again.");
      if (!append) setPeople([]);
    } else {
      const rows = result.data || [];
      setPeople(current => append ? [...current, ...rows] : rows);
      peopleOffset.current = from + rows.length;
      setPeopleHasMore(rows.length === PAGE_SIZE);
    }
    setPeopleLoading(false);
  }, [normalizedQuery]);

  const loadPosts = useCallback(async (append = false, request = requestId.current) => {
    if (!normalizedQuery) return;
    setPostsLoading(true);
    setPostsError("");
    const search = escapeSearch(normalizedQuery);

    // Resolve matching author IDs so search covers both post text and author names.
    const matchingProfiles = await supabase.from("profiles")
      .select("id")
      .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
      .limit(200);
    if (request !== requestId.current) return;
    if (matchingProfiles.error) {
      setPostsError("Posts could not be loaded. Please try again.");
      setPostsLoading(false);
      return;
    }

    const authorIds = (matchingProfiles.data || []).map(profile => profile.id).filter(Boolean);
    const clauses = [`body.ilike.%${search}%`];
    if (authorIds.length) clauses.push(`user_id.in.(${authorIds.join(",")})`);
    const from = append ? postsOffset.current : 0;
    const to = from + PAGE_SIZE - 1;
    const result = await supabase.from("posts")
      .select("id,user_id,body,created_at")
      .or(clauses.join(","))
      .order("created_at", { ascending: false })
      .range(from, to);
    if (request !== requestId.current) return;
    if (result.error) {
      setPostsError("Posts could not be loaded. Please try again.");
      if (!append) setPosts([]);
      setPostsLoading(false);
      return;
    }

    const rows = result.data || [];
    const authorIdsForRows = [...new Set(rows.map(post => post.user_id).filter(Boolean))];
    const authorsResult = authorIdsForRows.length
      ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", authorIdsForRows)
      : { data: [], error: null };
    if (request !== requestId.current) return;
    if (authorsResult.error) setPostsError("Post authors could not be loaded. Please try again.");
    const authorsById = Object.fromEntries((authorsResult.data || []).map(person => [person.id, person]));
    const mappedRows = rows.map(post => ({ ...post, author: authorsById[post.user_id] || {} }));
    setPosts(current => append ? [...current, ...mappedRows] : mappedRows);
    postsOffset.current = from + rows.length;
    setPostsHasMore(rows.length === PAGE_SIZE);
    setPostsLoading(false);
  }, [normalizedQuery]);

  useEffect(() => {
    const request = ++requestId.current;
    peopleOffset.current = 0;
    postsOffset.current = 0;
    setPeople([]);
    setPosts([]);
    setPeopleHasMore(false);
    setPostsHasMore(false);
    setPeopleError("");
    setPostsError("");
    if (!normalizedQuery) {
      setPeopleLoading(false);
      setPostsLoading(false);
      return;
    }
    loadPeople(false, request);
    loadPosts(false, request);
  }, [normalizedQuery, loadPeople, loadPosts]);

  const loadMorePeople = useCallback(() => loadPeople(true), [loadPeople]);
  const loadMorePosts = useCallback(() => loadPosts(true), [loadPosts]);

  return {
    people, posts, peopleLoading, postsLoading, peopleError, postsError,
    peopleHasMore, postsHasMore, loadMorePeople, loadMorePosts
  };
}
