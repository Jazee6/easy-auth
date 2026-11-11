export const ADMIN_PLUGIN_ENDPOINT_PROHIBITED = {
  code: "ADMIN_PLUGIN_ENDPOINT_PROHIBITED",
  message: "Use the Easy Auth administrator interface",
} as const;

const ADMINISTRATOR_ACCESS_ERROR = "AdministratorAccessForbiddenError";

/**
 * Mirrors the SQL check in admin-accounts.ts and scripts/recover-two-factor.sh:
 * remove every space, then look for an exact `admin` entry in the comma list.
 * Keep the three implementations identical.
 */
export function hasAdministratorRole(role: unknown): boolean {
  return typeof role === "string" && role.replaceAll(" ", "").split(",").includes("admin");
}

export function assertAdministratorRouteAccess(role: unknown): void {
  if (hasAdministratorRole(role)) return;

  const error = new Error("Administrator access required");
  error.name = ADMINISTRATOR_ACCESS_ERROR;
  throw error;
}

export function isAdministratorAccessError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === ADMINISTRATOR_ACCESS_ERROR
  );
}

/**
 * Every `/admin/*` path is treated as an Admin Plugin endpoint so endpoints added
 * by a future Better Auth release are denied by default. `/admin/oauth2/*`
 * belongs to the OAuth Provider plugin, whose endpoints are all SERVER_ONLY.
 */
export function isDirectAdminPluginPath(path: string | undefined): boolean {
  return path !== undefined && path.startsWith("/admin/") && !path.startsWith("/admin/oauth2/");
}

export function isAllowedDirectAdminPluginPath(path: string | undefined): boolean {
  return (
    path === "/admin/ban-user" ||
    path === "/admin/unban-user" ||
    path === "/admin/revoke-user-session" ||
    path === "/admin/revoke-user-sessions"
  );
}
