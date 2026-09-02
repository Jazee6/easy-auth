export const TWO_FACTOR_ENDPOINT_PROHIBITED = {
  code: "TWO_FACTOR_ENDPOINT_PROHIBITED",
  message: "This Two-Factor operation is not supported",
} as const;

export const UNSAFE_SESSION_ENDPOINT_PROHIBITED = {
  code: "SESSION_ENDPOINT_PROHIBITED",
  message: "Use the Easy Auth Session interface",
} as const;

const allowedTwoFactorPaths = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/generate-backup-codes",
]);

const unsafeSessionPaths = new Set([
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
]);

export function isDirectTwoFactorPath(path?: string): boolean {
  return path?.startsWith("/two-factor/") ?? false;
}

export function isAllowedDirectTwoFactorPath(path?: string): boolean {
  return path !== undefined && allowedTwoFactorPaths.has(path);
}

export function isUnsafeDirectSessionPath(path?: string): boolean {
  return path !== undefined && unsafeSessionPaths.has(path);
}

export function getAuthHandlerPath(requestUrl: string): string {
  const pathname = new URL(requestUrl).pathname;
  const authMountPath = "/api/auth";

  if (pathname === authMountPath) return "/";
  if (pathname.startsWith(`${authMountPath}/`)) return pathname.slice(authMountPath.length);
  return pathname;
}

export function getConstrainedAuthSurfaceError(
  path: string,
): typeof TWO_FACTOR_ENDPOINT_PROHIBITED | typeof UNSAFE_SESSION_ENDPOINT_PROHIBITED | null {
  if (isDirectTwoFactorPath(path) && !isAllowedDirectTwoFactorPath(path)) {
    return TWO_FACTOR_ENDPOINT_PROHIBITED;
  }

  if (isUnsafeDirectSessionPath(path)) {
    return UNSAFE_SESSION_ENDPOINT_PROHIBITED;
  }

  return null;
}
