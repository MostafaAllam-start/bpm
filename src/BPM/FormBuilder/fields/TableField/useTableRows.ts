// Resolves the API-fetched body rows for a display table whose `tableSource` is
// "api". Each response item becomes a row; `tableApi.columnKeys[i]` selects the
// value shown in column i. Returns loading/error so the renderer can show
// feedback. Manual tables (and the manual top/bottom rows of an API table) are
// handled in the renderer, not here.

import { useEffect, useState } from "react";
import type { FormField } from "../../types";
import { fetchApiList } from "../apiSource";

type State = { rows: string[][]; loading: boolean; error: string | null };

const IDLE: State = { rows: [], loading: false, error: null };

export function useTableRows(field: FormField): State {
  const isApi = field.tableSource === "api" && !!field.tableApi?.url;
  const api = field.tableApi;
  // A column's value comes from the item key at the same index; an empty key
  // yields an empty cell. The signature drives re-fetching when keys change.
  const keysSig = (api?.columnKeys ?? []).join("|");

  const [result, setResult] = useState<State>(() => ({
    rows: [],
    loading: isApi,
    error: null,
  }));

  useEffect(() => {
    // Not API-backed: nothing to fetch. Render returns the constant idle state
    // below, so there's no need to touch state here.
    if (!isApi || !api) return;

    let active = true;
    // Kick off the request: show loading immediately. This is the one place a
    // fetch hook must set state from the effect (the results land in the
    // callbacks below, which the rule doesn't flag).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult({ rows: [], loading: true, error: null });
    fetchApiList(api.url, api.path)
      .then((items) => {
        if (!active) return;
        const cols = keysSig.split("|");
        const rows = items.map((item) => {
          const record = (item ?? {}) as Record<string, unknown>;
          return cols.map((key) => {
            const value = key ? record[key] : undefined;
            return value == null ? "" : String(value);
          });
        });
        setResult({ rows, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setResult({
          rows: [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApi, api?.url, api?.path, keysSig]);

  return isApi ? result : IDLE;
}
