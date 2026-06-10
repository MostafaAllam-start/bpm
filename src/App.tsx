import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BpmnEditor from "./BpmnModeler";
import FormBuilder from "./FormEditor.tsx";
import { useAuthStore } from "./auth/authStore";
import "./App.css";

type SavedActorForm = {
  actorLabel: string;
  schema: object;
};

function App() {
  const navigate = useNavigate();
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
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>BPMN Studio</h1>
          <p>
            Model processes with the diagram editor, or open the actor form
            designer in a popup.
          </p>
        </div>
        <div className="app-account">
          {user?.userName && (
            <span className="app-account-name">{user.userName}</span>
          )}
          <button type="button" className="app-signout" onClick={handleSignOut}>
            Sign out
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
              aria-label="Close form"
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
