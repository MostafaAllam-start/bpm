// The form's submit button as a canvas widget. It reuses CanvasWidget's chrome,
// selection, and interact.js drag/resize wiring, has no delete control (it can't
// be removed), and renders a button preview. Its layout lives on schema.submit
// (keyed by SUBMIT_NAME), not in page.elements.

import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { LayoutBox } from "../types";
import { SUBMIT_NAME } from "./designerStore";
import CanvasWidget from "./CanvasWidget";

type SubmitContainerProps = {
  layout: LayoutBox;
  label?: string;
  locale: string;
  selected: boolean;
  primary: boolean;
};

function SubmitContainerImpl({
  layout,
  label,
  locale,
  selected,
  primary,
}: SubmitContainerProps) {
  const { t } = useTranslation("form");
  const text = label || t("designer.preview.submit");

  return (
    <CanvasWidget
      name={SUBMIT_NAME}
      layout={layout}
      locale={locale}
      selected={selected}
      primary={primary}
      modifier="is-submit"
      ariaLabel={text}
      badge={t("designer.submit.title")}
    >
      <button type="button" className="dz-submit-btn" disabled tabIndex={-1}>
        {text}
      </button>
    </CanvasWidget>
  );
}

export const SubmitContainer = memo(SubmitContainerImpl);
