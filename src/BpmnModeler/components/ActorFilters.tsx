import {
  ACTOR_KINDS,
  ACTOR_KIND_LABELS,
  ACTOR_ROLES,
  ACTOR_ROLE_LABELS,
} from "../constants.ts";
import type { ActorKind, ActorRole } from "../constants.ts";
import {
  getMainInfoEmployees,
  getOrgTypes,
  getOrgUnitManagers,
  getOrgUnits,
} from "../api/actorsApi.ts";
import type {
  EmployeeBrief,
  LightItem,
  ManagerBrief,
} from "../api/types.ts";
import type { ActorControls, ActorSelectorState, SelectOption } from "../types.ts";
import AsyncSearchSelect from "./AsyncSearchSelect.tsx";
import DependentSelect from "./DependentSelect.tsx";
import GroupPicker from "./GroupPicker.tsx";
import LocalSearchSelect from "./LocalSearchSelect.tsx";

const lightToOption = (item: LightItem): SelectOption => ({
  id: item.id,
  label: item.name,
});

const employeeToOption = (employee: EmployeeBrief): SelectOption => ({
  id: employee.id,
  label: employee.name,
  sublabel: employee.orgUnitName ?? undefined,
  image: employee.image,
});

const managerToOption = (manager: ManagerBrief): SelectOption => ({
  id: manager.id,
  label: manager.name,
  sublabel: manager.positionName ?? undefined,
  image: manager.image,
});

type ActorFiltersProps = {
  state: ActorSelectorState;
  controls: ActorControls;
};

// Renders the cascade of dropdowns for the chosen actor kind. The data lives in
// the per-picker hooks; this component only decides which pickers to show and
// routes their selections into the controller.
export default function ActorFilters({ state, controls }: ActorFiltersProps) {
  return (
    <div className="actor-filters">
      <div className="actor-popup-field">
        <label htmlFor="actor-name">Name</label>
        <input
          id="actor-name"
          type="text"
          value={state.name}
          placeholder="Enter a name for this actor…"
          onChange={(event) => controls.setName(event.target.value)}
        />
      </div>

      <div className="actor-popup-field">
        <label htmlFor="actor-kind">Actor type</label>
        <select
          id="actor-kind"
          value={state.kind}
          onChange={(event) => controls.setKind(event.target.value as ActorKind)}
        >
          {ACTOR_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ACTOR_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      {state.kind === "orgtype" && (
        <AsyncSearchSelect
          label="Org type"
          placeholder="Select an org type…"
          fetchPage={getOrgTypes}
          toOption={lightToOption}
          value={state.orgType}
          onSelect={controls.setOrgType}
          allowClear
          onClear={() => controls.setOrgType(null)}
        />
      )}

      {state.kind === "orgunit" && (
        <AsyncSearchSelect
          label="Org unit"
          placeholder="Select an org unit…"
          fetchPage={getOrgUnits}
          toOption={lightToOption}
          value={state.orgUnit}
          onSelect={controls.setOrgUnit}
          allowClear
          onClear={() => controls.setOrgUnit(null)}
        />
      )}

      {state.kind === "group" && (
        <>
          <GroupPicker
            value={state.group}
            onSelectGroup={controls.selectGroup}
            onClear={() => controls.selectGroup(null)}
          />
          <LocalSearchSelect
            label="Employee (optional)"
            placeholder="Any employee"
            options={state.groupEmployees}
            value={state.employee}
            onSelect={controls.setEmployee}
            disabled={!state.group}
            allowClear
            onClear={() => controls.setEmployee(null)}
            emptyHint="Select a group first"
          />
        </>
      )}

      {state.kind === "role" && (
        <>
          <div className="actor-popup-field">
            <label htmlFor="actor-role">Role</label>
            <select
              id="actor-role"
              value={state.role}
              onChange={(event) =>
                controls.setRole(event.target.value as ActorRole)
              }
            >
              {ACTOR_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ACTOR_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          {state.role === "employee" && (
            <AsyncSearchSelect
              label="Employee"
              placeholder="Search employees…"
              fetchPage={(params) =>
                getMainInfoEmployees({
                  employeeName: params.searchTerm,
                  cursor: params.cursor,
                  limit: params.limit,
                })
              }
              toOption={employeeToOption}
              value={state.employee}
              onSelect={controls.setEmployee}
              allowClear
              onClear={() => controls.setEmployee(null)}
            />
          )}

          {state.role === "manager" && (
            <>
              <AsyncSearchSelect
                label="Org unit"
                placeholder="Select an org unit…"
                fetchPage={getOrgUnits}
                toOption={lightToOption}
                value={state.orgUnit}
                onSelect={controls.setOrgUnit}
                allowClear
                onClear={() => controls.setOrgUnit(null)}
              />
              <DependentSelect
                label="Manager"
                placeholder="Select a manager…"
                dependencyKey={state.orgUnit?.id ?? null}
                load={() =>
                  getOrgUnitManagers(Number(state.orgUnit?.id)).then((managers) =>
                    managers.map(managerToOption),
                  )
                }
                value={state.manager}
                onSelect={controls.setManager}
                allowClear
                onClear={() => controls.setManager(null)}
                emptyHint="Select an org unit first"
              />
            </>
          )}
        </>
      )}

      {state.kind === "employee" && (
        <AsyncSearchSelect
          label="Employee"
          placeholder="Search employees…"
          fetchPage={(params) =>
            getMainInfoEmployees({
              employeeName: params.searchTerm,
              cursor: params.cursor,
              limit: params.limit,
            })
          }
          toOption={employeeToOption}
          value={state.employee}
          onSelect={controls.setEmployee}
          allowClear
          onClear={() => controls.setEmployee(null)}
        />
      )}

      {state.kind === "custom" && (
        <div className="actor-popup-field">
          <label htmlFor="actor-custom">Custom value</label>
          <input
            id="actor-custom"
            type="text"
            value={state.customValue}
            placeholder="Enter a custom actor…"
            onChange={(event) => controls.setCustomValue(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}
