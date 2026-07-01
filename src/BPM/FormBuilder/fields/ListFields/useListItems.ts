// Resolves the items for a list field: either the hand-entered `listItems`
// (resolved per locale), or — when `listItemsSource === "api"` — fetched from
// a remote endpoint and mapped via the optional `displayKey`. Returns
// loading/error so the renderer can show feedback.

import { useEffect, useState } from "react";
import type { FormField } from "../../types";
import { resolveText } from "../../utils/text";
import { getByPath, resolveFetchUrl } from "../apiSource";

type State = { items: string[]; loading: boolean; error: string | null };

export function useListItems(field: FormField, locale: string): State {
  const isApi = field.listItemsSource === "api" && !!field.listItemsApi?.url;
  const api = field.listItemsApi;
  const manualItems = field.listItems;

  const [state, setState] = useState<State>(() => ({
    items: isApi ? [] : (manualItems ?? []).map((item) => resolveText(item, locale)),
    loading: isApi,
    error: null,
  }));

  useEffect(() => {
    if (!isApi || !api?.url) {
      setState({
        items: (manualItems ?? []).map((item) => resolveText(item, locale)),
        loading: false,
        error: null,
      });
      return;
    }

    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetch(resolveFetchUrl(api.url))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((json) => {
        if (!active) return;
        const rawItems = getByPath(json, api.path);
        if (!Array.isArray(rawItems)) throw new Error("Path did not resolve to a list");
        const items = rawItems.map((item) => {
          if (api.displayKey && typeof item === "object" && item !== null) {
            const val = (item as Record<string, unknown>)[api.displayKey];
            return val == null ? "" : String(val);
          }
          return item == null ? "" : String(item);
        });
        setState({ items, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          items: [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApi, api?.url, api?.path, api?.displayKey, manualItems, locale]);

  return state;
}
