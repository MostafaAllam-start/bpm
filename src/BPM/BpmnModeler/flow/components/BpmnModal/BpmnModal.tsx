import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@shared/Modal";
import { ExpandIcon, CollapseIcon } from "../icons";

// Shared modal shell used by every BPMN editor dialog (ConditionModal,
// OutputMappingModal, RequestModal, …). Provides the standard chrome:
// title + expand/collapse + close in the header, an optional toolbar slot
// between header and body, a scrollable body, and a Cancel/Apply footer
// when `onApply` is provided. CSS reuses the .bf-cond-modal-* family so
// all dialogs look identical with no extra rules needed.

type BpmnModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  toolbar?: ReactNode;
  children: ReactNode;
};

export default function BpmnModal({
  open,
  title,
  subtitle,
  onClose,
  onApply,
  applyLabel,
  applyDisabled,
  toolbar,
  children,
}: BpmnModalProps) {
  const { t } = useTranslation("bpmn");
  const [expanded, setExpanded] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      backdropClassName="bf-cond-modal-backdrop"
      className="bf-cond-modal"
      full={expanded}
      closeOnBackdrop={false}
    >
      <div className="bf-cond-modal-head">
        <div className="bf-cond-modal-title-group">
          <span className="bf-cond-modal-title">{title}</span>
          {subtitle && (
            <span className="bf-cond-modal-subtitle">{subtitle}</span>
          )}
        </div>
        <div className="bf-cond-modal-head-actions">
          <button
            type="button"
            className="bf-cond-modal-icon-btn"
            aria-label={expanded ? t("props.collapseModal") : t("props.expandModal")}
            title={expanded ? t("props.collapseModal") : t("props.expandModal")}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button
            type="button"
            className="bf-cond-modal-icon-btn"
            aria-label={t("selector.cancel")}
            title={t("selector.cancel")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      {toolbar && (
        <div className="bf-cond-toolbar">{toolbar}</div>
      )}

      <div className="bf-cond-modal-body">
        {children}
      </div>

      {onApply && (
        <div className="bf-cond-modal-foot">
          <button type="button" className="bf-cond-cancel-btn" onClick={onClose}>
            {t("selector.cancel")}
          </button>
          <button
            type="button"
            className="bf-cond-apply-btn"
            disabled={applyDisabled}
            onClick={onApply}
          >
            {applyLabel ?? t("props.apply")}
          </button>
        </div>
      )}
    </Modal>
  );
}
