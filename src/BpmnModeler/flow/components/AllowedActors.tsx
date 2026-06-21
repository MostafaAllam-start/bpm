import { useTranslation } from "react-i18next";

import ActorSelectorModal from "../../components/ActorSelectorModal.tsx";
import type { ActorKind } from "../../constants.ts";
import { emptyActorState, useActorPicker } from "../hooks/useActorPicker.ts";
import type { AllowedActor } from "../types/index.ts";
import type { AvailableVariable } from "../utils/variables.ts";

type AllowedActorsProps = {
  value: AllowedActor[];
  onChange: (next: AllowedActor[]) => void;
  // Process variables a "custom" allowed actor can read its value from. (There
  // is no flow position here, so upstream-form variables don't apply.)
  availableVariables?: AvailableVariable[];
};

// A client-side React key for a newly added entry (never written to the BPMN
// XML). `crypto.randomUUID` is available in every browser this app targets.
function newId(): string {
  return crypto.randomUUID();
}

// A signature identifying an actor by its selection, so the same actor can't be
// added to the list twice.
function signature(props: Record<string, string>): string {
  return [
    props.actorKind,
    props.actorRole,
    props.actorPrimaryId,
    props.actorEmployeeId,
    props.actorValue,
  ].join("|");
}

// Process-level "Allowed actors" editor: a list of actors (employees, org units,
// groups, managers of an org unit, …) permitted to act on the process as a
// whole. It reuses the same cascading actor selector as task assignment, but
// appends each chosen actor to a list instead of writing onto a single element.
export default function AllowedActors({
  value,
  onChange,
  availableVariables,
}: AllowedActorsProps) {
  const { t } = useTranslation("bpmn");
  const picker = useActorPicker();

  const confirm = (): void => {
    const assignment = picker.build();
    if (!assignment) return;
    const sig = signature(assignment.props);
    if (!value.some((a) => signature(a.props) === sig)) {
      onChange([
        ...value,
        { id: newId(), label: assignment.name, props: assignment.props },
      ]);
    }
    picker.close();
  };

  const remove = (id: string): void =>
    onChange(value.filter((a) => a.id !== id));

  return (
    <>
      <div className="bf-prop-subtitle">{t("props.allowedActors")}</div>
      <div className="bf-var-hint">{t("props.allowedActorsHint")}</div>

      {value.length > 0 ? (
        <ul className="bf-actor-chips">
          {value.map((actor) => {
            const kind = actor.props.actorKind as ActorKind | undefined;
            return (
              <li key={actor.id} className="bf-actor-chip">
                <span className="bf-actor-chip-body">
                  <span className="bf-actor-chip-label">{actor.label}</span>
                  {kind && (
                    <span className="bf-actor-chip-kind">{t(`kind.${kind}`)}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="bf-actor-chip-remove"
                  title={t("props.removeActor")}
                  aria-label={t("props.removeActor")}
                  onClick={() => remove(actor.id)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bf-actor-empty">{t("props.noAllowedActors")}</div>
      )}

      <button
        type="button"
        className="bf-var-add"
        onClick={() => picker.open(emptyActorState(), availableVariables ?? [])}
      >
        + {t("props.addAllowedActor")}
      </button>

      {picker.selector && (
        <ActorSelectorModal
          actorSelector={picker.selector}
          controls={picker.controls}
          availableVariables={picker.availableVariables}
          canSave={picker.canSave}
          title={t("selector.addAllowedTitle")}
          saveLabel={t("selector.add")}
          onClose={picker.close}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
