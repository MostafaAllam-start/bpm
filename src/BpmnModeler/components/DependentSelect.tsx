import { useEffect, useRef, useState } from "react";

import type { SelectOption } from "../types.ts";
import LocalSearchSelect from "./LocalSearchSelect.tsx";

type DependentSelectProps = {
  label: string;
  placeholder?: string;
  // Re-runs `load` whenever this changes; when null the select is disabled
  // (e.g. no org unit picked yet) and shows `emptyHint`.
  dependencyKey: number | string | null;
  load: () => Promise<SelectOption[]>;
  value: SelectOption | null;
  onSelect: (option: SelectOption) => void;
  allowClear?: boolean;
  onClear?: () => void;
  emptyHint?: string;
};

// Results / errors are tagged with the key they were loaded for, so loading and
// emptiness can be derived by comparing against the current `dependencyKey`
// rather than reset with synchronous setState in the fetch effect.
type LoadResult = { key: number | string; options: SelectOption[] };
type LoadError = { key: number | string; message: string };

// A LocalSearchSelect whose options are fetched on demand from a parent
// selection (e.g. the employees / managers of a chosen org unit).
export default function DependentSelect({
  label,
  placeholder,
  dependencyKey,
  load,
  value,
  onSelect,
  allowClear,
  onClear,
  emptyHint = "Make the previous selection first",
}: DependentSelectProps) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [result, setResult] = useState<LoadResult | null>(null);
  const [failure, setFailure] = useState<LoadError | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (dependencyKey === null) return;
    const key = dependencyKey;
    const id = ++requestId.current;
    loadRef.current().then(
      (loaded) => {
        if (id === requestId.current) setResult({ key, options: loaded });
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        setFailure({
          key,
          message: err instanceof Error ? err.message : String(err),
        });
      },
    );
  }, [dependencyKey]);

  const disabled = dependencyKey === null;
  const hasResult = result?.key === dependencyKey;
  const error = failure?.key === dependencyKey ? failure.message : null;
  const options = hasResult ? result.options : [];
  const loading = !disabled && !error && !hasResult;

  return (
    <LocalSearchSelect
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onSelect={onSelect}
      loading={loading}
      error={error}
      disabled={disabled}
      allowClear={allowClear}
      onClear={onClear}
      emptyHint={disabled ? emptyHint : "No results"}
    />
  );
}
