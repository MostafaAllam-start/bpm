// Shared helpers for fields that can pull their data from a remote API (choice
// options, table rows). Keeps the fetch-URL handling and dot-path walking in one
// place so every API-backed field behaves the same.

// Cross-origin third-party APIs usually block direct browser fetches (CORS). In
// dev we route absolute URLs through the Vite dev proxy (see vite.config.ts) so
// testing against any API works. Relative URLs (e.g. "/api/categories") are
// already same-origin and pass through untouched.
export function resolveFetchUrl(url: string): string {
  if (import.meta.env.DEV && /^https?:\/\//i.test(url)) {
    return `/__cors?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Walk a dot-path ("categories.data", "data.0.items") into a parsed response.
// An empty/undefined path returns the value unchanged.
export function getByPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc != null && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

// Fetch a list from an API source: GET the URL (via the CORS-safe resolver),
// then resolve `path` to the array of items. Throws if the request fails or the
// path doesn't resolve to a list. Shared by the table field renderer, the
// designer's "test connection" button, and submit-time validation, so all three
// agree on what a working connection means.
export async function fetchApiList(url: string, path?: string): Promise<unknown[]> {
  const res = await fetch(resolveFetchUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  const items = getByPath(json, path);
  if (!Array.isArray(items)) throw new Error("Path did not resolve to a list");
  return items;
}
