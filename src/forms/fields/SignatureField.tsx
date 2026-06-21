// Signature field adapters. These wrap the reusable `SignaturePad` (draw /
// upload / url) and the read-only display variants, mapping the field's props
// onto each. The pad itself lives in `SignaturePad.tsx` so it can be reused
// outside the field renderer (e.g. the preset-image picker in the designer).

import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../fieldTypes";
import SignaturePad from "./SignaturePad";

// Interactive signature: the actor draws / uploads / links their signature.
export default function SignatureControl({
  value,
  onChange,
  id,
  disabled,
}: FieldRenderProps) {
  return (
    <SignaturePad
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      id={id}
      disabled={disabled}
    />
  );
}

// Preset signature: the designer set a fixed image in the field properties; the
// form just displays it (read-only — it carries no answer). No size caps: the
// image fits its field box (see the .ff-sign-preview rules).
export function SignaturePreset({ field }: FieldRenderProps) {
  const { t } = useTranslation("form");
  const src =
    typeof field.signatureValue === "string" ? field.signatureValue.trim() : "";
  if (!src) {
    return <div className="ff-embed-empty">{t("designer.types.signature")}</div>;
  }
  return (
    <div className="ff-sign-preview-wrap">
      <img className="ff-sign-preview" src={src} alt="" />
    </div>
  );
}

// Current-actor signature: a dynamic binding. At runtime the signature of the
// actor performing this step is inserted; in the designer we show a placeholder.
export function SignatureActorPlaceholder() {
  const { t } = useTranslation("form");
  return (
    <div className="ff-embed-empty ff-sign-actor">
      {t("designer.signature.currentActorPlaceholder")}
    </div>
  );
}
