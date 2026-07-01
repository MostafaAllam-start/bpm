import { useTranslation } from "react-i18next";

import { ACTOR_CUSTOM_SOURCES, ACTOR_KINDS, ACTOR_ROLES } from "../constants.ts";
import type { ActorCustomSource, ActorKind, ActorRole } from "../constants.ts";
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
import type { AvailableVariable } from "../flow/utils/variables.ts";
import AsyncSearchSelect from "./AsyncSearchSelect.tsx";
import DependentSelect from "./DependentSelect.tsx";
import GroupPicker from "./GroupPicker.tsx";

// Org types and org units display their logo (from `imageUrl`), falling back to
// a building glyph.
const lightToOption = (item: LightItem): SelectOption => ({
  id: item.id,
  label: item.name,
  image: item.image,
  iconKind: "org",
});

const employeeToOption = (employee: EmployeeBrief): SelectOption => ({
  id: employee.id,
  label: employee.name,
  sublabel: employee.orgUnitName ?? undefined,
  image: employee.image,
  iconKind: "person",
});

const managerToOption = (manager: ManagerBrief): SelectOption => ({
  id: manager.id,
  label: manager.name,
  sublabel: manager.positionName ?? undefined,
  image: manager.image,
  iconKind: "person",
});

type ActorFiltersProps = {
  state: ActorSelectorState;
  controls: ActorControls;
  // Variables offered when a "custom" actor reads its value from a process or
  // upstream-form variable.
  availableVariables: AvailableVariable[];
};

// Renders the cascade of dropdowns for the chosen actor kind. The data lives in
// the per-picker hooks; this component only decides which pickers to show and
// routes their selections into the controller.
export default function ActorFilters({
  state,
  controls,
  availableVariables,
}: ActorFiltersProps) {
  const { t } = useTranslation("bpmn");
  return (
    <div className="actor-filters">
      <div className="actor-popup-field">
        <label htmlFor="actor-kind">{t("filters.actorType")}</label>
        <select
          id="actor-kind"
          value={state.kind}
          onChange={(event) => controls.setKind(event.target.value as ActorKind)}
        >
          {ACTOR_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kind.${kind}`)}
            </option>
          ))}
        </select>
      </div>

      {state.kind === "orgtype" && (
        <AsyncSearchSelect
          label={t("filters.orgType")}
          placeholder={t("filters.orgTypePlaceholder")}
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
          label={t("filters.orgUnit")}
          placeholder={t("filters.orgUnitPlaceholder")}
          fetchPage={getOrgUnits}
          toOption={lightToOption}
          value={state.orgUnit}
          onSelect={controls.setOrgUnit}
          allowClear
          onClear={() => controls.setOrgUnit(null)}
        />
      )}

      {state.kind === "group" && (
        <GroupPicker
          value={state.group}
          onSelectGroup={controls.selectGroup}
          onClear={() => controls.selectGroup(null)}
        />
      )}

      {state.kind === "role" && (
        <>
          <div className="actor-popup-field">
            <label htmlFor="actor-role">{t("filters.role")}</label>
            <select
              id="actor-role"
              value={state.role}
              onChange={(event) =>
                controls.setRole(event.target.value as ActorRole)
              }
            >
              {ACTOR_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roleOption.${role}`)}
                </option>
              ))}
            </select>
          </div>

          {state.role === "employee" && (
            <AsyncSearchSelect
              label={t("filters.employee")}
              placeholder={t("filters.employeePlaceholder")}
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
                label={t("filters.orgUnit")}
                placeholder={t("filters.orgUnitPlaceholder")}
                fetchPage={getOrgUnits}
                toOption={lightToOption}
                value={state.orgUnit}
                onSelect={controls.setOrgUnit}
                allowClear
                onClear={() => controls.setOrgUnit(null)}
              />
              <DependentSelect
                label={t("filters.manager")}
                placeholder={t("filters.managerPlaceholder")}
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
                emptyHint={t("filters.selectOrgUnitFirst")}
              />
            </>
          )}
        </>
      )}

      {state.kind === "employee" && (
        <AsyncSearchSelect
          label={t("filters.employee")}
          placeholder={t("filters.employeePlaceholder")}
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
        <>
          <div className="actor-popup-field">
            <label htmlFor="actor-custom-source">
              {t("filters.customSource")}
            </label>
            <select
              id="actor-custom-source"
              value={state.customSource}
              onChange={(event) =>
                controls.setCustomSource(
                  event.target.value as ActorCustomSource,
                )
              }
            >
              {ACTOR_CUSTOM_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {t(`customSourceOption.${source}`)}
                </option>
              ))}
            </select>
          </div>

          {state.customSource === "text" ? (
            <div className="actor-popup-field">
              <label htmlFor="actor-custom">{t("filters.customValue")}</label>
              <input
                id="actor-custom"
                type="text"
                value={state.customValue}
                placeholder={t("filters.customPlaceholder")}
                onChange={(event) => controls.setCustomValue(event.target.value)}
              />
            </div>
          ) : (
            <CustomVariableField
              source={state.customSource}
              value={state.customValue}
              variables={availableVariables}
              onSelect={controls.setCustomValue}
            />
          )}
        </>
      )}
    </div>
  );
}

// The variable picker shown when a "custom" actor reads its value from a process
// variable or an upstream-form variable. The variables in scope are filtered by
// origin to match the chosen source.
function CustomVariableField({
  source,
  value,
  variables,
  onSelect,
}: {
  source: Exclude<ActorCustomSource, "text">;
  value: string;
  variables: AvailableVariable[];
  onSelect: (value: string) => void;
}) {
  const { t } = useTranslation("bpmn");
  const origin = source === "process" ? "global" : "task";
  const options = variables.filter((variable) => variable.origin === origin);
  const label =
    source === "process"
      ? t("filters.customProcessVar")
      : t("filters.customFormVar");

  return (
    <div className="actor-popup-field">
      <label htmlFor="actor-custom-var">{label}</label>
      {options.length > 0 ? (
        <select
          id="actor-custom-var"
          value={value}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">{t("filters.customVariablePlaceholder")}</option>
          {options.map((variable) => (
            <option key={variable.name} value={variable.name}>
              {variable.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="bf-var-hint">{t("filters.customNoVariables")}</div>
      )}
    </div>
  );
}
