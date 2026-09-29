import { describe, expect, test } from "bun:test";
import { oauthProvider } from "@better-auth/oauth-provider";

import {
  clientRegistrationSchema,
  clientUpdateSchema,
  getBannedUserId,
  getOAuthContinuationPayload,
  getOAuthManagementActionError,
  getPendingOAuthVerificationUrl,
  hasAdministratorRole,
  isDirectOAuthManagementPath,
  oauthClientCreatePayload,
  oauthSecurityEventPolicy,
  parseStoredStringArray,
  redactAuditSummary,
  scopeDescriptions,
  translateOAuthManagementError,
  validateOAuthPostLogoutRedirectUris,
  validateOAuthRedirectUris,
} from "./oauth-policy";
import * as v from "valibot";

describe("OAuth management policy", () => {
  test("recognizes only the administrator role", () => {
    expect(hasAdministratorRole("admin")).toBe(true);
    expect(hasAdministratorRole("user,admin")).toBe(true);
    expect(hasAdministratorRole("user, admin")).toBe(true);
    expect(hasAdministratorRole("user")).toBe(false);
    expect(hasAdministratorRole(undefined)).toBe(false);
  });

  test("allows the three supported client combinations", () => {
    for (const input of [
      { name: "Web confidential", applicationType: "web", authentication: "confidential" },
      { name: "Web public", applicationType: "web", authentication: "public" },
      { name: "Native public", applicationType: "native", authentication: "public" },
    ] as const) {
      expect(
        v.safeParse(clientRegistrationSchema, {
          ...input,
          redirectUris: ["https://client.example/callback"],
          postLogoutRedirectUris: [],
        }).success,
      ).toBe(true);
    }
  });

  test("rejects Native confidential clients", () => {
    expect(
      v.safeParse(clientRegistrationSchema, {
        name: "Native secret",
        applicationType: "native",
        authentication: "confidential",
        redirectUris: ["com.example.app:/callback"],
        postLogoutRedirectUris: [],
      }).success,
    ).toBe(false);
  });

  test("rejects redirect URIs that are not absolute URIs", () => {
    expect(
      v.safeParse(clientRegistrationSchema, {
        name: "Web app",
        applicationType: "web",
        authentication: "confidential",
        redirectUris: ["app.example/callback"],
        postLogoutRedirectUris: [],
      }).success,
    ).toBe(false);
  });

  test("builds a fixed least-privilege registration payload", () => {
    expect(
      oauthClientCreatePayload({
        name: " Example App ",
        applicationType: "web",
        authentication: "confidential",
        redirectUris: [
          "https://client.example/callback",
          "https://client.example/second",
          "https://client.example/callback",
        ],
        postLogoutRedirectUris: [" https://client.example/ ", "https://client.example/"],
      }),
    ).toEqual({
      client_name: "Example App",
      application_type: "web",
      redirect_uris: ["https://client.example/callback", "https://client.example/second"],
      post_logout_redirect_uris: ["https://client.example/"],
      token_endpoint_auth_method: "client_secret_basic",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email offline_access",
      require_pkce: true,
      client_secret_expires_at: 0,
      client_credentials_scopes: [],
      skip_consent: false,
      enable_end_session: true,
      subject_type: "public",
    });
  });

  test("omits post-logout redirect URIs when none are registered", () => {
    const payload = oauthClientCreatePayload({
      name: "Example App",
      applicationType: "web",
      authentication: "public",
      redirectUris: ["https://client.example/callback"],
      postLogoutRedirectUris: [" "],
    });
    expect("post_logout_redirect_uris" in payload).toBe(false);
    expect(payload.enable_end_session).toBe(true);
  });

  test("validates optional post-logout redirect URIs with the redirect URI rules", () => {
    expect(validateOAuthPostLogoutRedirectUris([], "web")).toBeNull();
    expect(validateOAuthPostLogoutRedirectUris(["https://client.example/"], "web")).toBeNull();
    expect(
      validateOAuthPostLogoutRedirectUris(["com.example-app:/signed-out"], "native"),
    ).toBeNull();
    const webError = validateOAuthPostLogoutRedirectUris(["http://localhost:3000/"], "web");
    expect(webError).toBe(
      "Post-logout redirect URIs: Web clients require HTTPS redirect URIs on non-loopback hosts.",
    );
    expect(translateOAuthManagementError(new Error(webError ?? ""))).toBe(
      "Web clients require HTTPS post-logout redirect URIs on non-loopback hosts.",
    );
    expect(
      translateOAuthManagementError(
        new Error(validateOAuthPostLogoutRedirectUris(["com.example:foo"], "native") ?? ""),
      ),
    ).toBe(
      "Use a claimed HTTPS URI, exact loopback URI, or authority-free reverse-domain URI for Native post-logout redirects.",
    );
  });

  test("audit summaries never retain credential values", () => {
    const redacted = redactAuditSummary({
      changed: ["name", "client_secret", "access_token", "refresh_token"],
      client_secret: "ea_cs_secret",
    });
    expect(redacted).toContain("name");
    expect(redacted.includes("secret")).toBe(false);
    expect(redacted.includes("token")).toBe(false);
  });

  test("keeps consent distinct from sessions and forced token invalidation", () => {
    expect(oauthSecurityEventPolicy.signOut).toEqual({ revokeTokens: false, deleteConsent: false });
    expect(oauthSecurityEventPolicy.passwordReset).toEqual({
      revokeTokens: false,
      deleteConsent: false,
    });
    expect(oauthSecurityEventPolicy.ban).toEqual({ revokeTokens: true, deleteConsent: false });
    expect(oauthSecurityEventPolicy.applicationAuthorizationRevocation).toEqual({
      revokeTokens: true,
      deleteConsent: true,
    });
  });

  test("blocks direct client mutation and non-atomic consent deletion paths", () => {
    for (const path of [
      "/oauth2/create-client",
      "/oauth2/update-client",
      "/oauth2/client/rotate-secret",
      "/oauth2/delete-client",
      "/oauth2/delete-consent",
      "/oauth2/update-consent",
    ]) {
      expect(isDirectOAuthManagementPath(path)).toBe(true);
    }
    expect(isDirectOAuthManagementPath("/oauth2/get-clients")).toBe(false);
  });

  test("reviews every HTTP endpoint the installed OAuth provider exposes", () => {
    // Protocol and read-only endpoints reviewed as safe to leave reachable over HTTP.
    const reviewedHttpPaths = new Set([
      "/oauth2/authorize",
      "/oauth2/consent",
      "/oauth2/continue",
      "/oauth2/end-session",
      "/oauth2/end-session/confirm",
      "/oauth2/get-client",
      "/oauth2/get-clients",
      "/oauth2/get-consent",
      "/oauth2/get-consents",
      "/oauth2/introspect",
      "/oauth2/public-client",
      "/oauth2/public-client-prelogin",
      "/oauth2/register",
      "/oauth2/revoke",
      "/oauth2/token",
      "/oauth2/userinfo",
    ]);
    const endpoints = Object.values(
      oauthProvider({ loginPage: "/login", consentPage: "/consent" }).endpoints,
    ) as { path: string; options: { metadata?: { SERVER_ONLY?: boolean } } }[];
    const httpPaths = endpoints
      .filter((endpoint) => !endpoint.options.metadata?.SERVER_ONLY)
      .map((endpoint) => endpoint.path);
    expect(httpPaths).toContain("/oauth2/token");
    expect(
      httpPaths.filter(
        (path) => !reviewedHttpPaths.has(path) && !isDirectOAuthManagementPath(path),
      ),
    ).toEqual([]);
  });

  test("uses the provider post-login continuation mode by default", () => {
    expect(getOAuthContinuationPayload()).toEqual({ postLogin: true });
    expect(getOAuthContinuationPayload({ created: true })).toEqual({ created: true });
  });

  test("preserves the signed authorization query through email verification", () => {
    const result = getPendingOAuthVerificationUrl(
      "?client_id=client-1&state=state-1&sig=signed&ba_param=client_id",
      " User@Example.com ",
    );
    expect(result).toBe(
      "/verify-email?client_id=client-1&state=state-1&sig=signed&ba_param=client_id&email=user%40example.com",
    );
    expect(getPendingOAuthVerificationUrl("?client_id=client-1", "user@example.com")).toBeNull();
  });

  test("recognizes every supported administrator ban path", () => {
    expect(getBannedUserId("/admin/ban-user", { userId: "user-1" })).toBe("user-1");
    expect(
      getBannedUserId("/admin/update-user", {
        userId: "user-2",
        data: { banned: true },
      }),
    ).toBe("user-2");
    expect(
      getBannedUserId("/admin/update-user", {
        userId: "user-2",
        data: { banned: false },
      }),
    ).toBeNull();
  });

  test("validates redirect URI policy before atomic client updates", () => {
    expect(validateOAuthRedirectUris(["https://client.example/callback"], "web")).toBeNull();
    for (const unsafeWebRedirect of [
      "http://127.0.0.1:4000/callback",
      "https://127.0.0.2/callback",
      "https://[0:0:0:0:0:0:0:1]/callback",
      "https://localhost./callback",
    ]) {
      expect(validateOAuthRedirectUris([unsafeWebRedirect], "web")).toBe(
        "Web clients require HTTPS redirect URIs on non-loopback hosts.",
      );
    }
    expect(validateOAuthRedirectUris(["http://127.0.0.1:4000/callback"], "native")).toBeNull();
    expect(validateOAuthRedirectUris(["http://127.0.0.2:4000/callback"], "native")).toBe(
      "Native HTTP redirects must use an exact loopback host.",
    );
  });

  test("shares provider-compatible native redirect URI validation between registration and updates", () => {
    const nativeRedirect = "com.example-app:/callback";
    expect(
      v.safeParse(clientRegistrationSchema, {
        name: "Native app",
        applicationType: "native",
        authentication: "public",
        redirectUris: [nativeRedirect],
        postLogoutRedirectUris: [],
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(clientUpdateSchema, {
        clientId: "client-native",
        name: "Native app",
        applicationType: "native",
        authentication: "public",
        redirectUris: [nativeRedirect],
        postLogoutRedirectUris: [],
      }).success,
    ).toBe(true);
    expect(validateOAuthRedirectUris([nativeRedirect], "native")).toBeNull();
    expect(validateOAuthRedirectUris(["com.example:foo"], "native")).toBe(
      "Native private-use redirect schemes must be authority-free reverse-domain names.",
    );
    expect(validateOAuthRedirectUris([nativeRedirect], "web")).toBe(
      "Web clients require HTTPS redirect URIs on non-loopback hosts.",
    );
  });

  test("maps provider failures to stable management guidance", () => {
    expect(
      translateOAuthManagementError({
        message: "web clients require https redirect URIs on non-loopback hosts",
      }),
    ).toBe("Web clients require HTTPS redirect URIs on non-loopback hosts.");
    expect(translateOAuthManagementError(new Error("raw framework details"))).toBe(
      "Unable to save the OAuth client. Check the application type and exact redirect URIs.",
    );
    expect(getOAuthManagementActionError("status", new Error("raw database details"))).toBe(
      "Unable to change the client status. Try again.",
    );
    expect(getOAuthManagementActionError("rotate", new Error("raw framework details"))).toBe(
      "Unable to rotate the client secret. Try again.",
    );
    expect(getOAuthManagementActionError("delete", new Error("raw provider details"))).toBe(
      "Unable to delete the OAuth client. Try again.",
    );
  });

  test("all supported scopes have account-facing descriptions", () => {
    expect(Object.keys(scopeDescriptions)).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
    ]);
  });
});

describe("parseStoredStringArray", () => {
  test("returns plain arrays filtered to strings", () => {
    expect(parseStoredStringArray(["a", "b"])).toEqual(["a", "b"]);
    expect(parseStoredStringArray(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });

  test("parses JSON-encoded strings", () => {
    expect(parseStoredStringArray('["https://a.example/cb"]')).toEqual(["https://a.example/cb"]);
  });

  test("returns empty for invalid payloads", () => {
    expect(parseStoredStringArray("not json")).toEqual([]);
    expect(parseStoredStringArray("42")).toEqual([]);
    expect(parseStoredStringArray(null)).toEqual([]);
    expect(parseStoredStringArray({ a: 1 })).toEqual([]);
  });
});
