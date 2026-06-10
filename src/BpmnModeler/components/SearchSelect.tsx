import { useEffect, useRef, useState } from "react";

import type { SelectOption } from "../types.ts";

type SearchSelectProps = {
  label: string;
  placeholder?: string;
  value: SelectOption | null;
  options: SelectOption[];
  searchTerm: string;
  onSearch: (term: string) => void;
  onSelect: (option: SelectOption) => void;
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  allowClear?: boolean;
  onClear?: () => void;
  disabled?: boolean;
  emptyHint?: string;
};

// Presentational searchable dropdown: a trigger showing the current value and a
// pop-over with a search box, the option list, and an optional "Load more".
// All data/behaviour is supplied via props — adapters wire in the source.
export default function SearchSelect({
  label,
  placeholder = "Select…",
  value,
  options,
  searchTerm,
  onSearch,
  onSelect,
  loading = false,
  error = null,
  hasMore = false,
  onLoadMore,
  allowClear = false,
  onClear,
  disabled = false,
  emptyHint = "No results",
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className="actor-select" ref={rootRef}>
      <span className="actor-select-label">{label}</span>
      <button
        type="button"
        className="actor-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? "actor-select-value" : "actor-select-placeholder"}>
          {value ? value.label : placeholder}
        </span>
        {allowClear && value && (
          <span
            className="actor-select-clear"
            role="button"
            aria-label="Clear selection"
            onClick={(event) => {
              event.stopPropagation();
              onClear?.();
            }}
          >
            ×
          </span>
        )}
        <span className="actor-select-caret">▾</span>
      </button>

      {open && !disabled && (
        <div className="actor-select-panel">
          <input
            className="actor-select-search"
            autoFocus
            value={searchTerm}
            placeholder="Search…"
            onChange={(event) => onSearch(event.target.value)}
          />
          <div className="actor-select-options">
            {error && (
              <div className="actor-select-msg actor-select-error">{error}</div>
            )}
            {!error && !loading && options.length === 0 && (
              <div className="actor-select-msg">{emptyHint}</div>
            )}
            {options.map((option) => (
              <button
                key={String(option.id)}
                type="button"
                className={
                  "actor-select-option" +
                  (value?.id === option.id ? " is-selected" : "")
                }
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                {option.image && (
                  <img className="actor-select-avatar" src={option.image} alt="" />
                )}
                <span className="actor-select-option-text">
                  <span className="actor-select-option-label">{option.label}</span>
                  {option.sublabel && (
                    <span className="actor-select-option-sub">
                      {option.sublabel}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {loading && <div className="actor-select-msg">Loading…</div>}
            {hasMore && !loading && onLoadMore && (
              <button
                type="button"
                className="actor-select-more"
                onClick={onLoadMore}
              >
                Load more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
