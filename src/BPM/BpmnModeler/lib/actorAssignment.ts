import type { ActorSelectorState } from "../types.ts";

// Flat string props written onto the BPMN element's business object via
// `modeling.updateProperties`. Kept as strings so they serialize cleanly as
// custom attributes (and round-trip through "Download all details").
export type ActorProps = Record<string, string>;

export type ActorAssignment = {
  // Human-readable label, also used as the element's `name`.
  name: string;
  props: ActorProps;
};

// Translate the in-progress selector state into the label + props to persist.
// Returns null when the required selection for the chosen kind is incomplete,
// which the UI uses to disable "Save".
export function buildActorAssignment(
  state: ActorSelectorState,
): ActorAssignment | null {
  const base = buildBaseAssignment(state);
  if (!base) return null;

  // The user-entered name, when present, overrides the derived label as the
  // element's display name. It's also stored as `actorName` so it round-trips
  // (and restores into the form).
  const name = state.name.trim();
  return {
    name: name || base.name,
    props: name ? { ...base.props, actorName: name } : base.props,
  };
}

// The label + props derived purely from the cascading selection (before the
// optional free-text name is applied on top).
function buildBaseAssignment(
  state: ActorSelectorState,
): ActorAssignment | null {
  switch (state.kind) {
    case "orgtype": {
      if (!state.orgType) return null;
      return {
        name: state.orgType.label,
        props: {
          actorKind: "orgtype",
          actorPrimaryId: String(state.orgType.id),
          actorPrimaryName: state.orgType.label,
        },
      };
    }

    case "orgunit": {
      if (!state.orgUnit) return null;
      const props: ActorProps = {
        actorKind: "orgunit",
        actorPrimaryId: String(state.orgUnit.id),
        actorPrimaryName: state.orgUnit.label,
      };
      let name = state.orgUnit.label;
      if (state.employee) {
        props.actorEmployeeId = String(state.employee.id);
        props.actorEmployeeName = state.employee.label;
        name = `${state.orgUnit.label} › ${state.employee.label}`;
      }
      return { name, props };
    }

    case "group": {
      if (!state.group) return null;
      return {
        name: state.group.label,
        props: {
          actorKind: "group",
          actorPrimaryId: String(state.group.id),
          actorPrimaryName: state.group.label,
        },
      };
    }

    case "role": {
      if (state.role === "employee") {
        if (!state.employee) return null;
        return {
          name: `Employee: ${state.employee.label}`,
          props: {
            actorKind: "role",
            actorRole: "employee",
            actorEmployeeId: String(state.employee.id),
            actorEmployeeName: state.employee.label,
          },
        };
      }
      // role === "manager": needs both an org unit and one of its managers.
      if (!state.orgUnit || !state.manager) return null;
      return {
        name: `Manager: ${state.manager.label} (${state.orgUnit.label})`,
        props: {
          actorKind: "role",
          actorRole: "manager",
          actorPrimaryId: String(state.orgUnit.id),
          actorPrimaryName: state.orgUnit.label,
          actorEmployeeId: String(state.manager.id),
          actorEmployeeName: state.manager.label,
        },
      };
    }

    case "employee": {
      if (!state.employee) return null;
      return {
        name: state.employee.label,
        props: {
          actorKind: "employee",
          actorEmployeeId: String(state.employee.id),
          actorEmployeeName: state.employee.label,
        },
      };
    }

    case "custom": {
      const value = state.customValue.trim();
      if (!value) return null;
      // Custom actors carry the value itself rather than an entity id. For the
      // "text" source it's the literal name; for the variable sources it's the
      // variable name, shown as a `{token}` so the label reads as dynamic and
      // resolved when the process runs.
      const isVariable = state.customSource !== "text";
      const label = isVariable ? `{${value}}` : value;
      return {
        name: label,
        props: {
          actorKind: "custom",
          actorValue: value,
          actorValueSource: state.customSource,
          actorPrimaryName: label,
        },
      };
    }

    default:
      return null;
  }
}
