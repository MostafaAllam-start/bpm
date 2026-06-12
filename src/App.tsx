import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BpmnEditor from "./BpmnModeler";
import FormBuilder from "./FormEditor.tsx";
import { useAuthStore } from "./auth/authStore";
import LanguageSwitcher from "./i18n/LanguageSwitcher";
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
  } | null>(null);

  const handleOpenActorForm = (actorId: string, actorLabel: string) => {
    const saved = savedActorForms[actorId];
    setActiveActorForm({
      actorId,
      // Prefer a label the user previously entered in the form over the
      // diagram-derived one.
      actorLabel: saved?.actorLabel ?? actorLabel,
      schema: saved?.schema,
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
    setActiveActorForm({ actorId, actorLabel, schema });
  };

  return (
    <div className="app rtl:text-right ltr:text-left">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2.5" y="4" width="7" height="6" rx="1.6" fill="currentColor" />
              <rect
                x="14.5"
                y="14"
                width="7"
                height="6"
                rx="1.6"
                fill="currentColor"
                opacity="0.85"
              />
              <path
                d="M9.5 7H14a2 2 0 0 1 2 2v5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="app-title">
            <h1>{t("title")}</h1>
            <p>{t("subtitle")}</p>
          </div>
        </div>
        <div className="app-account">
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
        />
      </main>

      {activeActorForm && (
        <div
          className="form-modal-backdrop"
          onClick={() => setActiveActorForm(null)}
        >
          <div
            className="form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="form-modal-close"
              aria-label={t("closeForm")}
              onClick={() => setActiveActorForm(null)}
            >
              ×
            </button>
            <FormBuilder
              actorId={activeActorForm.actorId}
              actorLabel={activeActorForm.actorLabel}
              existingSchema={activeActorForm.schema ?? null}
              onSave={(schema, actorLabel) =>
                handleSaveActorForm(
                  activeActorForm.actorId,
                  actorLabel || activeActorForm.actorLabel,
                  schema,
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
