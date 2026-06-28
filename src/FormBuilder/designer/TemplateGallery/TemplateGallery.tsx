import { useTranslation } from "react-i18next";
import type { FormSchema } from "../../types";
import { buildInitialSchema } from "../starter";
import type { TemplateDescriptor } from "../templates";
import "./TemplateGallery.css";

type Props = {
  templates: TemplateDescriptor[];
  onSelect: (schema: FormSchema) => void;
  onClose: () => void;
};

export default function TemplateGallery({ templates, onSelect, onClose }: Props) {
  const { t } = useTranslation("form");

  const pick = (schema: FormSchema) => {
    onSelect(schema);
    onClose();
  };

  return (
    <div className="tg-overlay" role="dialog" aria-modal="true" aria-label={t("designer.templates.title")}>
      <div className="tg-panel">
        <div className="tg-header">
          <h2 className="tg-title">{t("designer.templates.title")}</h2>
          <button type="button" className="tg-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="tg-grid">
          {/* Start blank */}
          <div className="tg-card" onClick={() => pick(buildInitialSchema(t))}>
            <div className="tg-card-icon tg-card-icon--blank">
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="8" y="5" width="24" height="30" rx="3" />
                <path d="M20 14v12M14 20h12" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="tg-card-name">{t("designer.templates.startBlank")}</h3>
            <p className="tg-card-desc">{t("designer.templates.startBlankDesc")}</p>
            <button type="button" className="tg-use-btn tg-use-btn--ghost" onClick={(e) => { e.stopPropagation(); pick(buildInitialSchema(t)); }}>
              {t("designer.templates.use")}
            </button>
          </div>

          {/* Template cards */}
          {templates.map((tpl) => (
            <div key={tpl.id} className="tg-card" onClick={() => pick(tpl.build(t))}>
              <div className="tg-card-icon">
                <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="6" y="4" width="28" height="32" rx="3" />
                  <path d="M12 13h16M12 19h16M12 25h10" strokeLinecap="round" />
                  <rect x="12" y="30" width="9" height="3.5" rx="1.5" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <h3 className="tg-card-name">{t(`designer.templates.${tpl.labelKey}`)}</h3>
              <p className="tg-card-desc">{t(`designer.templates.${tpl.descriptionKey}`)}</p>
              <button type="button" className="tg-use-btn" onClick={(e) => { e.stopPropagation(); pick(tpl.build(t)); }}>
                {t("designer.templates.use")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
