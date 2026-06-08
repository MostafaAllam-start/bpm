import { useState } from "react";
import BpmnEditor from "./BpmnModeler.tsx";
import FormBuilder from "./FormEditor.tsx";
import "./App.css";

type SavedActorForm = {
  actorLabel: string;
  schema: object;
};

function App() {
  const [savedActorForms, setSavedActorForms] = useState<
    Record<string, SavedActorForm>
  >({});
  const [activeActorForm, setActiveActorForm] = useState<{
    actorId: string;
    actorLabel: string;
    schema?: object | null;
  } | null>(null);

  const handleOpenActorForm = (actorId: string, actorLabel: string) => {
    setActiveActorForm({
      actorId,
      actorLabel,
      schema: savedActorForms[actorId]?.schema,
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
              onSave={(schema) =>
                handleSaveActorForm(
                  activeActorForm.actorId,
                  activeActorForm.actorLabel,
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
