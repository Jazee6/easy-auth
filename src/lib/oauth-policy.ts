import * as v from "valibot";

export const supportedScopes = ["openid", "profile", "email", "offline_access"] as const;

export const oauthSecurityEventPolicy = {
  signOut: { revokeTokens: false, deleteConsent: false },
  passwordReset: { revokeTokens: false, deleteConsent: false },
  ban: { revokeTokens: true, deleteConsent: false },
  applicationAuthorizationRevocation: { revokeTokens: true, deleteConsent: true },
} as const;

export const scopeDescriptions: Record<(typeof supportedScopes)[number], string> = {
  openid: "Confirm your stable Easy Auth account identity.",
  profile: "Read your account name and profile picture.",
  email: "Read your verified login email and verification state.",
  offline_access: "Keep access after you leave or sign out of Easy Auth.",
};

const baseClientRegistrationSchema = v.object({
  name: v.pipe(
    v.string("Application name is required"),
    v.trim(),
    v.nonEmpty("Application name is required"),
  ),
  applicationType: v.picklist(["web", "native"]),
  authentication: v.picklist(["confidential", "public"]),
  redirectUris: v.pipe(
    v.string("At least one redirect URI is required"),
    v.trim(),
    v.nonEmpty("At least one redirect URI is required"),
  ),
});

export const clientRegistrationSchema = v.pipe(
  baseClientRegistrationSchema,
  v.check(
    (input) => !(input.applicationType === "native" && input.authentication === "confidential"),
    "Native applications must be public clients",
  ),
);

export const clientUpdateSchema = v.object({
  clientId: v.pipe(v.string(), v.trim(), v.nonEmpty("Client ID is required")),
  name: baseClientRegistrationSchema.entries.name,
  applicationType: baseClientRegistrationSchema.entries.applicationType,
  redirectUris: baseClientRegistrationSchema.entries.redirectUris,
});

export type ClientRegistrationInput = v.InferOutput<typeof clientRegistrationSchema>;
export type ClientUpdateInput = v.InferOutput<typeof clientUpdateSchema>;

export interface PendingOAuthContinuation {
  selected?: boolean;
  created?: boolean;
  postLogin?: boolean;
}

export function getOAuthContinuationPayload(
  options?: PendingOAuthContinuation,
): PendingOAuthContinuation {
  return options ?? { postLogin: true };
}

export function getPendingOAuthVerificationUrl(search: string, email: string): string | null {
  const query = new URLSearchParams(search);
  if (!query.has("sig") || !query.has("client_id")) return null;
  query.set("email", email.trim().toLowerCase());
  return `/verify-email?${query.toString()}`;
}

const directOAuthManagementPaths = new Set([
  "/oauth2/create-client",
  "/oauth2/update-client",
  "/oauth2/client/rotate-secret",
  "/oauth2/delete-client",
  "/oauth2/delete-consent",
  "/oauth2/update-consent",
]);

export function isDirectOAuthManagementPath(path: string | undefined): boolean {
  return directOAuthManagementPaths.has(path ?? "");
}

export function hasAdministratorRole(role: unknown): boolean {
  return (
    typeof role === "string" &&
    role
      .split(",")
      .map((value) => value.trim())
      .includes("admin")
  );
}

export function getBannedUserId(path: string | undefined, body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const input = body as { userId?: unknown; data?: unknown };
  if (typeof input.userId !== "string" || input.userId.length === 0) return null;
  if (path === "/admin/ban-user") return input.userId;
  if (path !== "/admin/update-user" || typeof input.data !== "object" || input.data === null) {
    return null;
  }
  return (input.data as { banned?: unknown }).banned === true ? input.userId : null;
}

function normalizedHostname(hostname: string): string {
  const normalized = hostname.toLowerCase();
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = normalizedHostname(hostname);
  if (normalized === "::1" || /^localhost\.*$/.test(normalized)) return true;
  const octets = normalized.split(".");
  return octets.length === 4 && octets[0] === "127";
}

function isExactNativeLoopbackHostname(hostname: string): boolean {
  const normalized = normalizedHostname(hostname);
  return normalized === "localhost" || normalized === "::1" || normalized === "127.0.0.1";
}

export function validateOAuthRedirectUris(
  redirectUris: string[],
  applicationType: "web" | "native",
): string | null {
  if (redirectUris.length === 0) return "At least one redirect URI is required.";

  for (const redirectUri of redirectUris) {
    let url: URL;
    try {
      url = new URL(redirectUri);
    } catch {
      return "Redirect URIs must be absolute URIs.";
    }

    if (redirectUri.includes("#") || url.username || url.password) {
      return "Redirect URIs cannot contain credentials or fragments.";
    }

    const loopback = isLoopbackHostname(url.hostname);
    if (applicationType === "web") {
      if (url.protocol !== "https:" || loopback) {
        return "Web clients require HTTPS redirect URIs on non-loopback hosts.";
      }
      continue;
    }

    if (url.protocol === "https:") {
      if (loopback) return "Native HTTPS redirects cannot use loopback hosts.";
      continue;
    }

    if (url.protocol === "http:") {
      if (!isExactNativeLoopbackHostname(url.hostname)) {
        return "Native HTTP redirects must use an exact loopback host.";
      }
      continue;
    }

    const scheme = url.protocol.slice(0, -1);
    const reverseDomainScheme = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/i.test(scheme);
    if (url.host || !reverseDomainScheme) {
      return "Native private-use redirect schemes must be authority-free reverse-domain names.";
    }
  }

  return null;
}

function oauthManagementErrorText(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { code?: unknown; message?: unknown };
  return `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`.toLowerCase();
}

const oauthManagementActionErrors = {
  status: "Unable to change the client status. Try again.",
  rotate: "Unable to rotate the client secret. Try again.",
  delete: "Unable to delete the OAuth client. Try again.",
} as const;

export function getOAuthManagementActionError(
  action: keyof typeof oauthManagementActionErrors,
  _error: unknown,
): string {
  return oauthManagementActionErrors[action];
}

export function translateOAuthManagementError(error: unknown): string {
  const text = oauthManagementErrorText(error);
  if (text.includes("web clients require https")) {
    return "Web clients require HTTPS redirect URIs on non-loopback hosts.";
  }
  if (text.includes("native clients") || text.includes("private-use redirect")) {
    return "Use a claimed HTTPS URI, exact loopback URI, or authority-free reverse-domain URI for Native clients.";
  }
  if (text.includes("redirect") || text.includes("invalid_redirect_uri")) {
    return "Enter one valid exact redirect URI per line for the selected application type.";
  }
  if (text.includes("native applications must be public")) {
    return "Native applications must be public clients.";
  }
  return "Unable to save the OAuth client. Check the application type and exact redirect URIs.";
}

export function parseRedirectUris(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((uri) => uri.trim())
        .filter(Boolean),
    ),
  ];
}

export function oauthClientCreatePayload(input: ClientRegistrationInput) {
  return {
    client_name: input.name.trim(),
    application_type: input.applicationType,
    redirect_uris: parseRedirectUris(input.redirectUris),
    token_endpoint_auth_method:
      input.authentication === "confidential" ? "client_secret_basic" : "none",
    grant_types: ["authorization_code", "refresh_token"] as const,
    response_types: ["code"] as const,
    scope: supportedScopes.join(" "),
    require_pkce: true,
    client_secret_expires_at: 0,
    client_credentials_scopes: [] as string[],
    skip_consent: false,
    enable_end_session: false,
    subject_type: "public" as const,
  };
}

const sensitiveKey = /(secret|token|authorization.?code|credential|response)/i;

export function redactAuditSummary(summary: Record<string, unknown>): string {
  const safe = Object.fromEntries(
    Object.entries(summary).flatMap(([key, value]) => {
      if (sensitiveKey.test(key)) return [];
      if (Array.isArray(value)) {
        return [
          [key, value.filter((item) => typeof item === "string" && !sensitiveKey.test(item))],
        ];
      }
      return [[key, value]];
    }),
  );
  return JSON.stringify(safe);
}
