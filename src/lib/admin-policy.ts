export const ADMIN_PLUGIN_ENDPOINT_PROHIBITED = {
  code: "ADMIN_PLUGIN_ENDPOINT_PROHIBITED",
  message: "Use the Easy Auth administrator interface",
} as const;

const ADMINISTRATOR_ACCESS_ERROR = "AdministratorAccessForbiddenError";

export function hasAdministratorRole(role: unknown): boolean {
  return (
    typeof role === "string" &&
    role
      .split(",")
      .map((value) => value.trim())
      .includes("admin")
  );
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

const directAdminPluginPaths = new Set([
  "/admin/set-role",
  "/admin/get-user",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/unban-user",
  "/admin/ban-user",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/has-permission",
]);

export function isDirectAdminPluginPath(path: string | undefined): boolean {
  return directAdminPluginPaths.has(path ?? "");
}

export function isAllowedDirectAdminPluginPath(path: string | undefined): boolean {
  return path === "/admin/ban-user" || path === "/admin/unban-user";
}
