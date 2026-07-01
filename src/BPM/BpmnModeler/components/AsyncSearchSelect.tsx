import { usePagedSearch } from "../hooks/usePagedSearch.ts";
import type { PageFetcher } from "../hooks/usePagedSearch.ts";
import type { SelectOption } from "../types.ts";
import SearchSelect from "./SearchSelect.tsx";

type AsyncSearchSelectProps<T> = {
  label: string;
  placeholder?: string;
  fetchPage: PageFetcher<T>;
  toOption: (item: T) => SelectOption;
  value: SelectOption | null;
  onSelect: (option: SelectOption) => void;
  allowClear?: boolean;
  onClear?: () => void;
};

// Backs a SearchSelect with a server-paginated, searchable endpoint: the search
// box hits the API's search param (debounced) and "Load more" pages by cursor.
export default function AsyncSearchSelect<T>({
  label,
  placeholder,
  fetchPage,
  toOption,
  value,
  onSelect,
  allowClear,
  onClear,
}: AsyncSearchSelectProps<T>) {
  const { searchTerm, setSearchTerm, items, loading, error, hasMore, loadMore } =
    usePagedSearch(fetchPage);

  return (
    <SearchSelect
      label={label}
      placeholder={placeholder}
      value={value}
      options={items.map(toOption)}
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
      onSelect={onSelect}
      loading={loading}
      error={error}
      hasMore={hasMore}
      onLoadMore={loadMore}
      allowClear={allowClear}
      onClear={onClear}
    />
  );
}
