import { clearAuth, getToken } from "./authStore";

// The app calls the API directly at VITE_API_BASE (set in .env, e.g.
// https://api.ecmplus.org/api). This is a cross-origin call, so the API must
// return CORS headers for the site origin or the browser will block it.
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api.ecmplus.org/api";

/** Error carrying the API's message/code so the UI can show something useful. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// The dev API's error envelope looks like:
//   { success: false, error, errorCode, errors: [...], metadata }
// and ASP.NET ProblemDetails like:
//   { title, status, errors: { Field: ["msg"] } }
type ErrorEnvelope = {
  error?: string;
  errorCode?: string;
  title?: string;
  errors?: unknown;
};

function messageFromEnvelope(body: ErrorEnvelope, status: number): string {
  if (typeof body?.error === "string" && body.error) return body.error;
  if (body?.errors && typeof body.errors === "object" && !Array.isArray(body.errors)) {
    const first = Object.values(body.errors as Record<string, unknown>)[0];
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  if (typeof body?.title === "string" && body.title) return body.title;
  return `Request failed (${status}).`;
}

const looksLikeJwt = (v: unknown): v is string =>
  typeof v === "string" && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(v);

// The login success shape isn't documented in swagger, so search the response
// for a JWT: first under any token-ish key, then any JWT-looking string.
function extractToken(value: unknown): string | null {
  if (looksLikeJwt(value)) return value;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, v] of entries) {
      if (/token|jwt|access/i.test(key) && looksLikeJwt(v)) return v;
    }
    for (const [, v] of entries) {
      const found = extractToken(v);
      if (found) return found;
    }
  }
  return null;
}

export type LoginResult = { token: string; raw: unknown };

export async function login(
  userName: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/Account/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    // tokenNotification is for push registration; the API accepts an empty value.
    body: JSON.stringify({ userName, password, tokenNotification: "" }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      messageFromEnvelope(body ?? {}, res.status),
      res.status,
      body?.errorCode,
    );
  }

  const token = extractToken(body);
  if (!token) {
    throw new ApiError(
      "Logged in, but no token was found in the response.",
      res.status,
    );
  }
  return { token, raw: body };
}

/** fetch wrapper that attaches the stored Bearer token. */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  // An expired / rejected token comes back as 401. Clear auth so the
  // RequireAuth gate redirects the user to /login.
  if (res.status === 401) clearAuth();
  return res;
}
