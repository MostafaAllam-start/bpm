import { useCallback, useEffect, useRef, useState } from "react";

import { ACTOR_PAGE_SIZE } from "../constants.ts";
import type { Paged } from "../api/types.ts";

export type PageFetcher<T> = (params: {
  cursor?: number;
  searchTerm?: string;
  limit?: number;
}) => Promise<Paged<T>>;

// Drives a searchable, cursor-paginated list: debounces the search term,
// (re)loads page one on change, and appends pages via `loadMore`. Stale
// responses (from a superseded search or a racing load-more) are discarded.
export function usePagedSearch<T>(
  fetchPage: PageFetcher<T>,
  options: { limit?: number } = {},
) {
  const { limit = ACTOR_PAGE_SIZE } = options;

  // Keep the latest fetcher in a ref so an inline-arrow `fetchPage` doesn't
  // retrigger the effect every render. Updated in an effect (never during
  // render) and only read later from timeouts / handlers.
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each load tags itself; only the most recent may commit its result.
  const requestId = useRef(0);

  const runFetch = useCallback(
    async (nextCursor: number | null, term: string, append: boolean) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchRef.current({
          cursor: nextCursor ?? undefined,
          searchTerm: term || undefined,
          limit,
        });
        if (id !== requestId.current) return;
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [limit],
  );

  // Debounced (re)load of the first page whenever the search term changes.
  useEffect(() => {
    const handle = setTimeout(() => runFetch(null, searchTerm, false), 300);
    return () => clearTimeout(handle);
  }, [searchTerm, runFetch]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    runFetch(cursor, searchTerm, true);
  }, [loading, hasMore, cursor, searchTerm, runFetch]);

  return {
    searchTerm,
    setSearchTerm,
    items,
    loading,
    error,
    hasMore,
    loadMore,
  };
}
