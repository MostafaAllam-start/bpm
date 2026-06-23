import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BpmnEditor, { type ActorFormMeta, type AvailableVariable } from "@bpmn";
import type { DesignerVariable } from "@forms";
import Modal from "@shared/Modal";
import BrandLogo from "@app/BrandLogo";
import FormBuilder from "@forms/FormEditor";
import { useAuthStore } from "@/auth/authStore";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import ThemeToggle from "@app/ThemeToggle";
import "./App.css";

type SavedActorForm = {
  actorLabel: string;
  schema: object;
};

function App() {
  const navigate = useNavigate();
  const { t } = useTranslation("studio");
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const [savedActorForms, setSavedActorForms] = useState<
    Record<string, SavedActorForm>
  >({});
  const [activeActorForm, setActiveActorForm] = useState<{
    actorId: string;
    actorLabel: string;
    schema?: object | null;
    currentActor?: ActorFormMeta;
    availableVariables?: DesignerVariable[];
  } | null>(null);
  // Whether the form-designer modal is expanded to fill the whole window.
  const [formFull, setFormFull] = useState(false);
  const closeActorForm = () => {
    setActiveActorForm(null);
    setFormFull(false);
  };

  const handleOpenActorForm = (
    actorId: string,
    actorLabel: string,
    currentActor?: ActorFormMeta,
    availableVariables?: AvailableVariable[],
  ) => {
    const saved = savedActorForms[actorId];
    setActiveActorForm({
      actorId,
      // Prefer a label the user previously entered in the form over the
      // diagram-derived one.
      actorLabel: saved?.actorLabel ?? actorLabel,
      schema: saved?.schema,
      currentActor,
      // BPM `AvailableVariable` is a structural superset of the designer's
      // `DesignerVariable` (both derive from the shared `VariableRef` base), so
      // the in-scope variables pass straight through — no lossy remap. The extra
      // `type` field rides along and is simply ignored by the designer.
      availableVariables: availableVariables ?? [],
    });
  };

  const handleSaveActorForm = (
    actorId: string,
    actorLabel: string,
    schema: object,
  ) => {
    setSavedActorForms((current) => ({
      ...current,
      [actorId]: { actorLabel, schema },
    }));
    setActiveActorForm((prev) =>
      prev?.actorId === actorId
        ? { ...prev, actorLabel, schema }
        : { actorId, actorLabel, schema },
    );
  };

  return (
    <div className="app rtl:text-right ltr:text-left">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">
            <BrandLogo />
          </span>
          <div className="app-title">
            <h1>{t("title")}</h1>
            <p>{t("subtitle")}</p>
          </div>
        </div>
        <div className="app-account">
          <ThemeToggle />
          <LanguageSwitcher />
          {user?.userName && (
            <span className="app-account-name">{user.userName}</span>
          )}
          <button type="button" className="app-signout" onClick={handleSignOut}>
            {t("signOut")}
          </button>
        </div>
      </header>

      <main className="app-main">
        <BpmnEditor
          savedActorForms={savedActorForms}
          onOpenActorForm={handleOpenActorForm}
          onLoadExampleForms={setSavedActorForms}
        />
      </main>

      <Modal
        open={!!activeActorForm}
        onClose={closeActorForm}
        backdropClassName="form-modal-backdrop"
        className="form-modal"
        full={formFull}
        // The form designer holds unsaved edits — don't discard them on Escape.
        closeOnEscape={false}
      >
        {activeActorForm && (
          <FormBuilder
            actorId={activeActorForm.actorId}
            actorLabel={activeActorForm.actorLabel}
            existingSchema={activeActorForm.schema ?? null}
            currentActor={activeActorForm.currentActor ?? null}
            availableVariables={activeActorForm.availableVariables ?? []}
            maximized={formFull}
            onToggleMaximize={() => setFormFull((v) => !v)}
            onClose={closeActorForm}
            onSave={(schema, actorLabel) =>
              handleSaveActorForm(
                activeActorForm.actorId,
                actorLabel || activeActorForm.actorLabel,
                schema,
              )
            }
          />
        )}
      </Modal>
    </div>
  );
}

export default App;
