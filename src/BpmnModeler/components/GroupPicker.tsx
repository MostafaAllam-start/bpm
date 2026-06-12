import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getGroups } from "../api/actorsApi.ts";
import type { Group } from "../api/types.ts";
import type { SelectOption } from "../types.ts";
import LocalSearchSelect from "./LocalSearchSelect.tsx";

type GroupPickerProps = {
  value: SelectOption | null;
  onSelectGroup: (group: Group) => void;
  onClear: () => void;
};

// Loads the groups once and renders a searchable select. Emits the full Group
// (not just an option) so the caller can read its embedded member list.
export default function GroupPicker({
  value,
  onSelectGroup,
  onClear,
}: GroupPickerProps) {
  const { t } = useTranslation("bpmn");
  const [groups, setGroups] = useState<Group[]>([]);
  // Starts true: the list loads once on mount, so loading needn't be flipped
  // on synchronously inside the effect.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getGroups({ limit: 100 }).then(
      (page) => {
        if (!active) return;
        setGroups(page.items);
        setLoading(false);
      },
      (err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const options: SelectOption[] = groups.map((group) => ({
    id: group.id,
    label: group.name,
    image: group.image,
  }));

  return (
    <LocalSearchSelect
      label={t("filters.group")}
      placeholder={t("filters.groupPlaceholder")}
      options={options}
      value={value}
      loading={loading}
      error={error}
      allowClear
      onClear={onClear}
      onSelect={(option) => {
        const group = groups.find((candidate) => candidate.id === option.id);
        if (group) onSelectGroup(group);
      }}
    />
  );
}
