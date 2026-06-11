/**
 * Lightweight admin gate for internal analytics/export. This is deliberately
 * NOT a user auth system (none exists): it checks a shared `ADMIN_TOKEN` env
 * value against a `key` query param or an `x-admin-token` header. When
 * `ADMIN_TOKEN` is unset (e.g. local dev), access is open.
 */

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

/** Authorize a request by header or `key` query param. */
export function isAuthorizedRequest(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  const header = request.headers.get("x-admin-token");
  if (header === token) return true;
  const key = new URL(request.url).searchParams.get("key");
  return key === token;
}

/** Authorize a server component from its `key` search param. */
export function isAuthorizedKey(key: string | undefined): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  return key === token;
}
