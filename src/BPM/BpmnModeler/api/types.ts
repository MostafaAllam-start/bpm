// Server-side shapes returned by the EcmPlus actor endpoints, normalized to the
// minimal fields the actor selector needs. The raw responses carry much more;
// the API client (actorsApi.ts) maps them down to these.

// A cursor-paginated list ("items" + nextCursor + hasMore) as returned by the
// people / group / light list endpoints.
export type Paged<T> = {
  items: T[];
  nextCursor: number | null;
  hasMore: boolean;
};

// Minimal { id, name } record from the "light" list endpoints (org types, org
// units). `image` is the entity's logo (mapped from `imageUrl`/`logo`) when the
// server provides one.
export type LightItem = {
  id: number;
  name: string;
  image?: string | null;
};

// An employee as surfaced by the various people endpoints. `orgUnitName` is the
// display path of their org unit when available.
export type EmployeeBrief = {
  id: number;
  name: string;
  image?: string | null;
  email?: string | null;
  orgUnitName?: string | null;
  positionName?: string | null;
};

// A group of employees plus its members (flattened from `employeeGroups`).
export type Group = {
  id: number;
  name: string;
  image?: string | null;
  employees: EmployeeBrief[];
};

// A manager of an org unit (from the hierarchy endpoint).
export type ManagerBrief = {
  id: number;
  name: string;
  image?: string | null;
  email?: string | null;
  positionName?: string | null;
};
