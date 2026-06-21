// Resolves the options for a choice field: either the hand-entered `choices`,
// or — when `choicesSource === "api"` — fetched from a remote endpoint and
// mapped via the configured value/display keys. Returns loading/error so the
// renderer can show feedback.

import { useEffect, useState } from "react";
import type { Choice, FormField } from "../types";
import { getByPath, resolveFetchUrl } from "./apiSource";

type State = { options: Choice[]; loading: boolean; error: string | null };

export function useChoiceOptions(field: FormField): State {
  const isApi = field.choicesSource === "api" && !!field.choicesApi?.url;
  const api = field.choicesApi;
  const manual = field.choices;

  const [state, setState] = useState<State>(() => ({
    options: isApi ? [] : manual ?? [],
    loading: isApi,
    error: null,
  }));

  // Re-resolve when the source or its inputs change. Manual mode mirrors the
  // field's `choices`; API mode fetches and maps.
  useEffect(() => {
    if (!isApi || !api) {
      setState({ options: manual ?? [], loading: false, error: null });
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetch(resolveFetchUrl(api.url))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        const items = getByPath(json, api.path);
        if (!Array.isArray(items)) {
          throw new Error("Path did not resolve to a list");
        }
        const options: Choice[] = items.map((item) => {
          const record = (item ?? {}) as Record<string, unknown>;
          const value = record[api.valueKey];
          const display = record[api.displayKey];
          return {
            value: String(value ?? ""),
            text: { default: String(display ?? value ?? "") },
          };
        });
        setState({ options, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          options: [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApi, api?.url, api?.path, api?.valueKey, api?.displayKey, manual]);

  return state;
}
