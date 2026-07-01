import { apiFetch } from "../../../auth/api.ts";
import type {
  EmployeeBrief,
  Group,
  LightItem,
  ManagerBrief,
  Paged,
} from "./types.ts";

// Common params for the searchable, cursor-paginated list endpoints.
export type PageParams = {
  cursor?: number;
  searchTerm?: string;
  limit?: number;
};

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asString = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

function toNumberId(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

// First non-empty of a set of common name fields, falling back to the id.
function pickName(rec: Record<string, unknown>): string {
  for (const key of ["name", "nameEn", "displayName", "displayPath", "title"]) {
    const value = rec[key];
    if (typeof value === "string" && value) return value;
  }
  return String(rec.id ?? "");
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function errorMessage(body: unknown, status: number): string {
  const rec = asRecord(body);
  return (
    asString(rec.error) ??
    asString(rec.message) ??
    asString(rec.title) ??
    `Request failed (${status}).`
  );
}

async function getJson(path: string): Promise<unknown> {
  const res = await apiFetch(path);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return body;
}

// The list payload lives at .items, .data.items, .data (array), or is the body
// itself; the cursor lives at the top level or under .data.
function extractItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asRecord(body);
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.data)) return root.data;
  const dataItems = asRecord(root.data).items;
  if (Array.isArray(dataItems)) return dataItems;
  return [];
}

function extractCursor(body: unknown): {
  nextCursor: number | null;
  hasMore: boolean;
} {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const hasMore = Boolean(root.hasMore ?? data.hasMore ?? false);
  const raw = root.nextCursor ?? data.nextCursor;
  let nextCursor: number | null = null;
  if (typeof raw === "number") nextCursor = raw;
  else if (typeof raw === "string" && raw.trim() && !Number.isNaN(Number(raw))) {
    nextCursor = Number(raw);
  }
  return { nextCursor, hasMore };
}

// ---------------------------------------------------------------------------
// Entity mappers
// ---------------------------------------------------------------------------

// Maps an employee from any of the people endpoints (org-unit tree, group
// members, main-info list) to the common EmployeeBrief shape.
function toEmployee(raw: unknown): EmployeeBrief {
  const rec = asRecord(raw);
  const orgUnit = asRecord(rec.orgUnit);
  const mainInfoOrgUnit = asRecord(rec.mainInfoOrgUnit);
  const position = asRecord(rec.position);
  return {
    id: toNumberId(rec.id),
    name: pickName(rec),
    image: asString(rec.image),
    email: asString(rec.email),
    orgUnitName:
      asString(rec.orgUnitName) ??
      asString(orgUnit.displayPath) ??
      asString(mainInfoOrgUnit.displayPath) ??
      null,
    positionName: asString(rec.positionName) ?? asString(position.name),
  };
}

function toManager(raw: unknown): ManagerBrief {
  const rec = asRecord(raw);
  return {
    id: toNumberId(rec.id),
    name: pickName(rec),
    image: asString(rec.image),
    email: asString(rec.email),
    positionName: asString(rec.positionName),
  };
}

function toLightPage(body: unknown): Paged<LightItem> {
  const { nextCursor, hasMore } = extractCursor(body);
  const items = extractItems(body).map((raw) => {
    const rec = asRecord(raw);
    return {
      id: toNumberId(rec.id),
      name: pickName(rec),
      // Org types / units expose their logo as `imageUrl`; fall back to the
      // other names the endpoints sometimes use.
      image: asString(rec.imageUrl) ?? asString(rec.logo) ?? asString(rec.image),
    };
  });
  return { items, nextCursor, hasMore };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /OrgType/GetLightOrgTypes — searchable list of org types. */
export async function getOrgTypes(params: PageParams): Promise<Paged<LightItem>> {
  return toLightPage(await getJson(`/OrgType/GetLightOrgTypes${buildQuery(params)}`));
}

/** GET /OrgUnit/GetLightOrgUnits — searchable list of org units. */
export async function getOrgUnits(params: PageParams): Promise<Paged<LightItem>> {
  return toLightPage(await getJson(`/OrgUnit/GetLightOrgUnits${buildQuery(params)}`));
}

/** GET /groupOfEmployee/GetAllGroupOfEmployee — groups with their members. */
export async function getGroups(params: PageParams): Promise<Paged<Group>> {
  const body = await getJson(
    `/groupOfEmployee/GetAllGroupOfEmployee${buildQuery({
      cursor: params.cursor,
      limit: params.limit,
    })}`,
  );
  const { nextCursor, hasMore } = extractCursor(body);
  const items = extractItems(body).map((raw) => {
    const rec = asRecord(raw);
    return {
      id: toNumberId(rec.id),
      name: pickName(rec),
      image: asString(rec.logo),
      employees: asArray(rec.employeeGroups).map(toEmployee),
    };
  });
  return { items, nextCursor, hasMore };
}

/** GET /employee/GetMainInfoEmployees — searchable list of employees. */
export async function getMainInfoEmployees(params: {
  employeeName?: string;
  orgUnitId?: number;
  cursor?: number;
  limit?: number;
}): Promise<Paged<EmployeeBrief>> {
  const body = await getJson(
    `/employee/GetMainInfoEmployees${buildQuery({
      employeeName: params.employeeName,
      orgUnitId: params.orgUnitId,
      cursor: params.cursor,
      limit: params.limit,
    })}`,
  );
  const { nextCursor, hasMore } = extractCursor(body);
  return { items: extractItems(body).map(toEmployee), nextCursor, hasMore };
}

/**
 * GET /OrgUnit/{id}/Employees?includeChildren=true — returns a tree (root +
 * nested children); we flatten it to a deduped employee list.
 */
export async function getOrgUnitEmployees(
  orgUnitId: number,
): Promise<EmployeeBrief[]> {
  const body = await getJson(
    `/OrgUnit/${orgUnitId}/Employees?includeChildren=true`,
  );
  const root = asRecord(asRecord(body).data).root;
  const employees: EmployeeBrief[] = [];
  const seen = new Set<number>();

  const walk = (node: unknown): void => {
    const rec = asRecord(node);
    for (const raw of asArray(rec.employees)) {
      const employee = toEmployee(raw);
      if (!seen.has(employee.id)) {
        seen.add(employee.id);
        employees.push(employee);
      }
    }
    for (const child of asArray(rec.children)) walk(child);
  };

  if (Object.keys(asRecord(root)).length) walk(root);
  return employees;
}

/**
 * GET /OrgUnit/Hierarchy — full org tree; we return the managers of the node
 * matching `orgUnitId` (empty if the unit has none / isn't found).
 */
export async function getOrgUnitManagers(
  orgUnitId: number,
): Promise<ManagerBrief[]> {
  const body = await getJson(`/OrgUnit/Hierarchy`);
  const nodes = asArray(asRecord(asRecord(body).data).nodes);
  for (const node of nodes) {
    const data = asRecord(asRecord(node).data);
    if (toNumberId(data.orgUnitId) === orgUnitId) {
      return asArray(data.managers).map(toManager);
    }
  }
  return [];
}
