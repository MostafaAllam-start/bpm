// The form's title as a canvas widget. Like the submit button it reuses
// CanvasWidget's chrome, selection, and interact.js drag/resize wiring, has no
// delete control, and renders the title text with its configured typography. Its
// placement + style live on schema.titleBox (keyed by TITLE_NAME); the text
// itself is schema.title.

import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { FormTitle, LayoutBox } from "../types";
import { titleTextStyle } from "../titleStyle";
import { TITLE_NAME } from "./designerStore";
import CanvasWidget from "./CanvasWidget";

type TitleContainerProps = {
  layout: LayoutBox;
  // The resolved title text for the active locale ("" when the form is untitled).
  title: string;
  // The title's typography (size / family / weight / style / color).
  style: FormTitle | undefined;
  locale: string;
  selected: boolean;
  primary: boolean;
};

function TitleContainerImpl({
  layout,
  title,
  style,
  locale,
  selected,
  primary,
}: TitleContainerProps) {
  const { t } = useTranslation("form");
  const text = title || t("designer.title.placeholder");

  return (
    <CanvasWidget
      name={TITLE_NAME}
      layout={layout}
      locale={locale}
      selected={selected}
      primary={primary}
      modifier="is-title"
      ariaLabel={text}
      badge={t("designer.title.title")}
    >
      <div
        className={`dz-title-preview${title ? "" : " is-placeholder"}`}
        style={titleTextStyle(style)}
      >
        {text}
      </div>
    </CanvasWidget>
  );
}

export const TitleContainer = memo(TitleContainerImpl);
