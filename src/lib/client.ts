'use client';

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

/** Fetch a Typeface Hub API route as the signed-in user in a workspace. */
export async function api<T = unknown>(workspace: string | null, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      ...(init.body !== undefined && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(workspace ? { 'X-Workspace': workspace } : {}),
    },
    body: init.body instanceof FormData ? init.body : init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error?.message ?? `Request failed (${res.status})`, res.status, data?.error?.details);
  return data as T;
}
