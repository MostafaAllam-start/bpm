import { useState } from "react";

import type { SelectOption } from "../types.ts";
import SearchSelect from "./SearchSelect.tsx";

type LocalSearchSelectProps = {
  label: string;
  placeholder?: string;
  options: SelectOption[];
  value: SelectOption | null;
  onSelect: (option: SelectOption) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  allowClear?: boolean;
  onClear?: () => void;
  emptyHint?: string;
};

// Backs a SearchSelect with an in-memory option list, filtering client-side as
// the user types (no pagination). Used for lists already held in memory or
// fetched in one shot.
export default function LocalSearchSelect({
  options,
  ...rest
}: LocalSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const needle = searchTerm.trim().toLowerCase();
  const filtered = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  return (
    <SearchSelect
      {...rest}
      options={filtered}
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
    />
  );
}
