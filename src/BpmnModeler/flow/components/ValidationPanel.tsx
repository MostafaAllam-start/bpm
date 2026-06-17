import { useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { useValidationStore } from "../store/validationStore.ts";

// A collapsible panel listing the current validation issues. Clicking an issue
// pans/zooms to the offending node. Reads straight from the validation store.
// Anchored to the top corner that trails the reading direction: top-right in
// LTR, top-left in RTL.
export default function ValidationPanel() {
  const { t, i18n } = useTranslation("bpmn");
  const issues = useValidationStore((s) => s.issues);
  const { getNode, setCenter } = useReactFlow();
  const [open, setOpen] = useState(true);

  const position = i18n.dir() === "rtl" ? "top-left" : "top-right";

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.length - errorCount;

  const focus = (nodeId?: string) => {
    if (!nodeId) return;
    const node = getNode(nodeId);
    if (!node) return;
    const w = (node.width as number) || (node.measured?.width as number) || 40;
    const h = (node.height as number) || (node.measured?.height as number) || 40;
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.2, duration: 300 });
  };

  return (
    <Panel position={position} className={`bf-validation${issues.length ? "" : " bf-validation-ok"}`}>
      <button type="button" className="bf-validation-head" onClick={() => setOpen((o) => !o)}>
        <span className={`bf-validation-dot ${issues.length ? (errorCount ? "is-error" : "is-warn") : "is-ok"}`} />
        {issues.length === 0
          ? t("validation.valid")
          : t("validation.summary", { errors: errorCount, warnings: warnCount })}
        <span className="bf-validation-caret">{open ? "▾" : "▸"}</span>
      </button>

      {open && issues.length > 0 && (
        <ul className="bf-validation-list">
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                className={`bf-validation-item bf-validation-${issue.severity}`}
                onClick={() => focus(issue.nodeId)}
              >
                {t(issue.messageKey, issue.params)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
