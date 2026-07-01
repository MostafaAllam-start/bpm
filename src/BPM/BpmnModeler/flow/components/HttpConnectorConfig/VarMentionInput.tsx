import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import MentionInput from "@shared/MentionInput";
import type { MentionGroup } from "@shared/MentionInput";
import type { AvailableVariable } from "../../utils/variables.ts";

type Props = {
  value: string;
  onChange: (v: string) => void;
  availableVars: AvailableVariable[];
  placeholder?: string;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
  multiline?: boolean;
};

export default function VarMentionInput({
  value,
  onChange,
  availableVars,
  placeholder,
  className,
  dir,
  multiline,
}: Props) {
  const { t } = useTranslation("bpmn");

  const groups = useMemo((): MentionGroup[] => {
    const globals = availableVars.filter((v) => v.origin === "global");
    const bySource = new Map<string, AvailableVariable[]>();
    for (const v of availableVars.filter((v) => v.origin === "task")) {
      const src = v.source ?? t("props.varCategory.form");
      const list = bySource.get(src);
      if (list) list.push(v);
      else bySource.set(src, [v]);
    }
    const result: MentionGroup[] = [];
    if (globals.length)
      result.push({
        key: "process",
        label: t("props.varCategory.process"),
        vars: globals.map((v) => ({ ...v, meta: v.type })),
      });
    for (const [src, vars] of bySource)
      result.push({
        key: `task:${src}`,
        label: src,
        vars: vars.map((v) => ({ ...v, meta: v.type })),
      });
    return result;
  }, [availableVars, t]);

  const tokenLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of availableVars) {
      const token = `{${v.ref ?? v.name}}`;
      const label =
        v.origin === "task" && v.source ? `${v.source}.${v.name}` : v.name;
      if (!map.has(token)) map.set(token, label);
    }
    return map;
  }, [availableVars]);

  return (
    <MentionInput
      value={value}
      onChange={onChange}
      groups={groups}
      tokenLabels={tokenLabels}
      placeholder={placeholder}
      surfaceClassName="bf-mention-input"
      className={className}
      dir={dir}
      multiline={multiline}
    />
  );
}
