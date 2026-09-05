import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import { createEasyAuth } from "./auth-factory";
import {
  deleteOAuthClientAtomically,
  revokeApplicationAuthorizationAtomically,
  setOAuthClientDisabledAtomically,
  updateOAuthClientAtomically,
} from "./oauth-management";

const BASE_URL = "http://easy-auth.test";

let miniflare: Miniflare;
let database: D1Database;
let auth: ReturnType<typeof createEasyAuth>;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2025-09-02",
      compatibilityFlags: ["nodejs_compat"],
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: "easy-auth-test" },
    }),
  );
  database = (await miniflare.getD1Database("DB")) as unknown as D1Database;

  const migrations = (await readdir("drizzle")).filter((path) => path.endsWith(".sql")).sort();
  for (const migration of migrations) {
    const statements = (await readFile(join("drizzle", migration), "utf8"))
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement));
    await database.batch(statements);
  }

  auth = createEasyAuth({
    environment: {
      DB: database,
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "integration-test-secret-at-least-32-characters",
      GITHUB_CLIENT_ID: "github-integration-client",
      GITHUB_CLIENT_SECRET: "github-integration-secret",
      GOOGLE_CLIENT_ID: "google-integration-client",
      GOOGLE_CLIENT_SECRET: "google-integration-secret",
    },
    sendAuthEmail: async () => {},
    captchaEnabled: false,
    tanstackCookiesEnabled: false,
  });
});

afterAll(async () => {
  await miniflare.dispose();
});

async function getAuth(path: string, headers?: HeadersInit): Promise<Response> {
  return auth.handler(new Request(`${BASE_URL}/api/auth${path}`, { headers }));
}

async function postAuth(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: BASE_URL });
  if (cookie) headers.set("cookie", cookie);
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

async function postAuthForm(
  path: string,
  body: URLSearchParams,
  authorization?: string,
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    origin: BASE_URL,
  });
  if (authorization) headers.set("authorization", authorization);
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers,
      body,
    }),
  );
}

async function createVerifiedAccount(email: string, role = "user"): Promise<string> {
  await database.prepare("DELETE FROM rate_limit").run();
  const response = await postAuth("/sign-up/email", {
    name: email.split("@")[0],
    email,
    password: "integration-password",
  });
  expect(response.status).toBe(200);
  const result = (await response.json()) as { user: { id: string } };
  await database
    .prepare("UPDATE user SET email_verified = 1, role = ? WHERE id = ?")
    .bind(role, result.user.id)
    .run();
  return result.user.id;
}

async function signInCookie(email: string): Promise<string> {
  const response = await postAuth("/sign-in/email", {
    email,
    password: "integration-password",
  });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie === null).toBe(false);
  if (!setCookie) throw new Error("Sign in did not set a session cookie");
  return setCookie.split(";", 1)[0];
}

describe("Session cookie configuration", () => {
  test("uses the ea prefix and bypasses cached Sessions for authoritative reads", async () => {
    const email = "cookie-cache@example.com";
    const accountId = await createVerifiedAccount(email);
    expect(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId),
    ).toBe(true);
    await database.prepare("DELETE FROM rate_limit").run();

    const response = await postAuth("/sign-in/email", {
      email,
      password: "integration-password",
    });
    expect(response.status).toBe(200);

    const setCookies = response.headers.getSetCookie();
    expect(setCookies.some((cookie) => cookie.startsWith("ea.session_token="))).toBe(true);
    expect(setCookies.some((cookie) => cookie.startsWith("ea.session_data="))).toBe(true);
    const lastLoginMethodCookie = setCookies.find((cookie) =>
      cookie.startsWith("better-auth.last_used_login_method=email"),
    );
    expect(lastLoginMethodCookie).toBeDefined();
    expect(lastLoginMethodCookie?.toLowerCase().includes("httponly")).toBe(false);
    expect(lastLoginMethodCookie).toContain("Max-Age=2592000");
    const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
    const headers = new Headers({ cookie });

    expect((await auth.api.getSession({ headers })) === null).toBe(false);
    await database.prepare("DELETE FROM session WHERE user_id = ?").bind(accountId).run();

    expect((await auth.api.getSession({ headers })) === null).toBe(false);
    expect(
      await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      }),
    ).toBeNull();
  });
});

describe("External identity provider HTTP integration", () => {
  test("starts Google authorization with the configured callback", async () => {
    const response = await postAuth("/sign-in/social", {
      provider: "google",
      callbackURL: "/profile",
      newUserCallbackURL: "/profile",
      errorCallbackURL: "/login?provider=google",
    });
    expect(response.status).toBe(200);

    const result = (await response.json()) as { redirect: boolean; url: string };
    const authorizationUrl = new URL(result.url);
    expect(result.redirect).toBe(true);
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(authorizationUrl.searchParams.get("client_id")).toBe("google-integration-client");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      `${BASE_URL}/api/auth/callback/google`,
    );
  });
});

describe("Admin boundary HTTP integration", () => {
  test("default-denies every direct Admin Plugin read and mutation", async () => {
    const adminEmail = "admin-default-deny@example.com";
    const accountEmail = "account-default-deny@example.com";
    const targetId = await createVerifiedAccount("target-default-deny@example.com");
    await createVerifiedAccount(adminEmail, "admin");
    await createVerifiedAccount(accountEmail);
    const adminCookie = await signInCookie(adminEmail);
    const accountCookie = await signInCookie(accountEmail);
    const blockedRequests = [
      { method: "GET", path: "/admin/list-users" },
      { method: "GET", path: `/admin/get-user?id=${targetId}` },
      { method: "POST", path: "/admin/list-user-sessions", body: { userId: targetId } },
      { method: "POST", path: "/admin/has-permission", body: { permissions: {} } },
      {
        method: "POST",
        path: "/admin/create-user",
        body: {
          name: "Smuggled administrator",
          email: "smuggled@example.com",
          password: "integration-password",
          role: "admin",
        },
      },
      {
        method: "POST",
        path: "/admin/update-user",
        body: { userId: targetId, data: { role: "admin", banned: true } },
      },
      { method: "POST", path: "/admin/set-role", body: { userId: targetId, role: "admin" } },
      {
        method: "POST",
        path: "/admin/set-user-password",
        body: { userId: targetId, newPassword: "replacement-password" },
      },
      { method: "POST", path: "/admin/remove-user", body: { userId: targetId } },
      { method: "POST", path: "/admin/impersonate-user", body: { userId: targetId } },
      { method: "POST", path: "/admin/stop-impersonating", body: {} },
    ] as const;

    for (const cookie of [adminCookie, accountCookie, undefined]) {
      for (const blockedRequest of blockedRequests) {
        const response =
          blockedRequest.method === "GET"
            ? await getAuth(blockedRequest.path, cookie ? { cookie } : undefined)
            : await postAuth(blockedRequest.path, blockedRequest.body, cookie);

        expect(response.status).toBe(403);
        expect((await response.json()) as unknown).toEqual({
          code: "ADMIN_PLUGIN_ENDPOINT_PROHIBITED",
          message: "Use the Easy Auth administrator interface",
        });
      }
    }

    expect(
      await database
        .prepare("SELECT count(*) AS count FROM user WHERE email = ?")
        .bind("smuggled@example.com")
        .first<number>("count"),
    ).toBe(0);
    expect(
      await database
        .prepare("SELECT role FROM user WHERE id = ?")
        .bind(targetId)
        .first<string>("role"),
    ).toBe("user");
  });
});

describe("OAuth HTTP integration", () => {
  test("blocks direct consent expansion at the auth handler", async () => {
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/oauth2/update-consent`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ id: "consent-1", update: { scopes: ["openid", "email"] } }),
      }),
    );

    expect(response.status).toBe(403);
    const error = (await response.json()) as { code?: string };
    expect(error.code).toBe("OAUTH_MANAGEMENT_SERVER_ONLY");
  });

  test("keeps client mutations, audit records, and generated-state deletion atomic", async () => {
    const now = Date.now();
    await database.batch([
      database
        .prepare(
          "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role) VALUES (?, ?, ?, 1, ?, ?, 'admin')",
        )
        .bind("owner-lifecycle", "Owner", "owner-lifecycle@example.com", now, now),
      database
        .prepare(
          "INSERT INTO oauth_client (id, client_id, user_id, redirect_uris, name, application_type, disabled) VALUES (?, ?, ?, ?, ?, 'web', 0)",
        )
        .bind(
          "client-row-lifecycle",
          "client-lifecycle",
          "owner-lifecycle",
          '["https://old.example/callback"]',
          "Old name",
        ),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "verification-lifecycle",
          "authorization-code-lifecycle",
          JSON.stringify({
            type: "authorization_code",
            query: { client_id: "client-lifecycle" },
          }),
          now + 60_000,
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "verification-unrelated",
          "authorization-code-unrelated",
          JSON.stringify({ type: "authorization_code", query: { client_id: "other-client" } }),
          now + 60_000,
          now,
          now,
        ),
    ]);

    await updateOAuthClientAtomically(database, {
      clientId: "client-lifecycle",
      ownerUserId: "owner-lifecycle",
      name: "New name",
      redirectUris: ["https://new.example/callback"],
      audit: {
        id: "audit-lifecycle-update",
        actorUserId: "owner-lifecycle",
        clientName: "New name",
        action: "update",
        summary: '{"changed":["name","redirectUris"]}',
        createdAt: now,
      },
    });

    expect(
      await database
        .prepare("SELECT name FROM oauth_client WHERE client_id = ?")
        .bind("client-lifecycle")
        .first<string>("name"),
    ).toBe("New name");
    expect(
      await database
        .prepare("SELECT application_type FROM oauth_client WHERE client_id = ?")
        .bind("client-lifecycle")
        .first<string>("application_type"),
    ).toBe("web");

    let rollbackError: unknown;
    try {
      await setOAuthClientDisabledAtomically(database, {
        clientId: "client-lifecycle",
        ownerUserId: "owner-lifecycle",
        disabled: true,
        audit: {
          id: "audit-lifecycle-update",
          actorUserId: "owner-lifecycle",
          clientName: "New name",
          action: "disable",
          summary: '{"disabled":true}',
          createdAt: now,
        },
      });
    } catch (error) {
      rollbackError = error;
    }
    expect(rollbackError instanceof Error).toBe(true);
    expect(
      await database
        .prepare("SELECT disabled FROM oauth_client WHERE client_id = ?")
        .bind("client-lifecycle")
        .first<number>("disabled"),
    ).toBe(0);

    await deleteOAuthClientAtomically(database, {
      clientId: "client-lifecycle",
      ownerUserId: "owner-lifecycle",
      audit: {
        id: "audit-lifecycle-delete",
        actorUserId: "owner-lifecycle",
        clientName: "New name",
        action: "delete",
        summary: '{"deleted":true}',
        createdAt: now,
      },
    });

    expect(
      await database
        .prepare("SELECT count(*) AS count FROM oauth_client WHERE client_id = ?")
        .bind("client-lifecycle")
        .first<number>("count"),
    ).toBe(0);
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM verification WHERE id = ?")
        .bind("verification-lifecycle")
        .first<number>("count"),
    ).toBe(0);
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM verification WHERE id = ?")
        .bind("verification-unrelated")
        .first<number>("count"),
    ).toBe(1);
  });

  test("covers consent denial, first acceptance, reuse, narrower scopes, and expansion", async () => {
    const adminEmail = "admin-consent@example.com";
    const accountEmail = "account-consent@example.com";
    await createVerifiedAccount(adminEmail, "admin");
    await createVerifiedAccount(accountEmail);
    const adminCookie = await signInCookie(adminEmail);
    const accountCookie = await signInCookie(accountEmail);
    const client = await auth.api.adminCreateOAuthClient({
      headers: new Headers({ cookie: adminCookie }),
      body: {
        client_name: "Consent client",
        application_type: "web",
        redirect_uris: ["https://consent-client.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "openid profile email offline_access",
        require_pkce: true,
        client_secret_expires_at: 0,
        client_credentials_scopes: [],
        skip_consent: false,
        enable_end_session: false,
        subject_type: "public",
      },
    });
    const verifier = "consent-verifier-that-is-at-least-forty-three-characters-long";
    const challenge = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ).toString("base64url");

    const authorize = async (scope: string, state: string) => {
      const query = new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: "https://consent-client.example/callback",
        response_type: "code",
        scope,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return getAuth(`/oauth2/authorize?${query.toString()}`, {
        cookie: accountCookie,
        accept: "text/html",
      });
    };

    const deniedAuthorization = await authorize("openid profile", "denied-state");
    const deniedConsentLocation = deniedAuthorization.headers.get("location");
    if (!deniedConsentLocation) throw new Error("Authorization did not request consent");
    expect(new URL(deniedConsentLocation, BASE_URL).pathname).toBe("/consent");
    const deniedResponse = await postAuth(
      "/oauth2/consent",
      {
        accept: false,
        oauth_query: new URL(deniedConsentLocation, BASE_URL).search.slice(1),
      },
      accountCookie,
    );
    const denied = (await deniedResponse.json()) as { url?: string };
    if (!denied.url) throw new Error("Consent denial did not return a client redirect");
    expect(new URL(denied.url).searchParams.get("error")).toBe("access_denied");
    expect(new URL(denied.url).searchParams.get("state")).toBe("denied-state");

    const firstAuthorization = await authorize("openid profile", "first-state");
    const firstConsentLocation = firstAuthorization.headers.get("location");
    if (!firstConsentLocation) throw new Error("First authorization did not request consent");
    expect(new URL(firstConsentLocation, BASE_URL).pathname).toBe("/consent");
    const acceptedResponse = await postAuth(
      "/oauth2/consent",
      {
        accept: true,
        oauth_query: new URL(firstConsentLocation, BASE_URL).search.slice(1),
      },
      accountCookie,
    );
    expect(acceptedResponse.status).toBe(200);

    for (const [scope, state] of [
      ["openid profile", "reuse-state"],
      ["openid", "narrower-state"],
    ] as const) {
      const response = await authorize(scope, state);
      const location = response.headers.get("location");
      if (!location) throw new Error("Reusable consent did not redirect to the client");
      const callback = new URL(location, BASE_URL);
      expect(callback.origin).toBe("https://consent-client.example");
      expect(callback.searchParams.get("state")).toBe(state);
      expect(typeof callback.searchParams.get("code")).toBe("string");
    }

    const expandedAuthorization = await authorize("openid profile email", "expanded-state");
    const expandedLocation = expandedAuthorization.headers.get("location");
    if (!expandedLocation) throw new Error("Expanded authorization did not request consent");
    expect(new URL(expandedLocation, BASE_URL).pathname).toBe("/consent");
  });

  test("completes Authorization Code, OIDC, refresh, UserInfo, introspection, and revocation over HTTP", async () => {
    const adminEmail = "admin-protocol@example.com";
    const accountEmail = "account-protocol@example.com";
    await createVerifiedAccount(adminEmail, "admin");
    await createVerifiedAccount(accountEmail);
    const adminCookie = await signInCookie(adminEmail);
    const accountCookie = await signInCookie(accountEmail);

    const client = await auth.api.adminCreateOAuthClient({
      headers: new Headers({ cookie: adminCookie }),
      body: {
        client_name: "Protocol client",
        application_type: "web",
        redirect_uris: ["https://client.example/callback"],
        token_endpoint_auth_method: "client_secret_basic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "openid profile email offline_access",
        require_pkce: true,
        client_secret_expires_at: 0,
        client_credentials_scopes: [],
        skip_consent: false,
        enable_end_session: false,
        subject_type: "public",
      },
    });

    if (!client.client_secret) throw new Error("Confidential client did not return its secret");
    const clientAuthorization = `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64")}`;
    const verifier = "protocol-verifier-that-is-at-least-forty-three-characters-long";
    const challenge = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ).toString("base64url");
    const authorize = new URL(`${BASE_URL}/api/auth/oauth2/authorize`);
    authorize.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope: "openid profile email offline_access",
      state: "protocol-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

    const authorizationResponse = await getAuth(
      `${authorize.pathname.replace("/api/auth", "")}${authorize.search}`,
      { cookie: accountCookie, accept: "text/html" },
    );
    expect(authorizationResponse.status).toBe(302);
    const consentLocation = authorizationResponse.headers.get("location");
    if (!consentLocation) throw new Error("Authorization did not redirect to consent");
    expect(new URL(consentLocation, BASE_URL).pathname).toBe("/consent");

    const consentResponse = await postAuth(
      "/oauth2/consent",
      {
        accept: true,
        oauth_query: new URL(consentLocation, BASE_URL).search.slice(1),
      },
      accountCookie,
    );
    expect(consentResponse.status).toBe(200);
    const consent = (await consentResponse.json()) as { url?: string };
    if (!consent.url) throw new Error("Consent did not return a client redirect");
    const callback = new URL(consent.url);
    expect(callback.searchParams.get("state")).toBe("protocol-state");
    const code = callback.searchParams.get("code");
    if (!code) throw new Error("Consent did not issue an authorization code");

    const tokenResponse = await postAuthForm(
      "/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        redirect_uri: "https://client.example/callback",
        code,
        code_verifier: verifier,
      }),
      clientAuthorization,
    );
    expect(tokenResponse.status).toBe(200);
    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      id_token: string;
    };
    expect(tokens.access_token.startsWith("ea_at_")).toBe(true);
    expect(tokens.refresh_token.startsWith("ea_rt_")).toBe(true);
    expect(typeof tokens.id_token).toBe("string");

    const jwksResponse = await getAuth("/jwks");
    expect(jwksResponse.status).toBe(200);
    const jwks = (await jwksResponse.json()) as JSONWebKeySet;
    const verifiedIdToken = await jwtVerify(tokens.id_token, createLocalJWKSet(jwks), {
      issuer: `${BASE_URL}/api/auth`,
      audience: client.client_id,
    });
    expect(typeof verifiedIdToken.payload.sub).toBe("string");

    const introspectionResponse = await postAuthForm(
      "/oauth2/introspect",
      new URLSearchParams({
        token: tokens.access_token,
        token_type_hint: "access_token",
      }),
      clientAuthorization,
    );
    expect(introspectionResponse.status).toBe(200);
    const introspection = (await introspectionResponse.json()) as {
      active?: boolean;
      client_id?: string;
      sub?: string;
    };
    expect(introspection.active).toBe(true);
    expect(introspection.client_id).toBe(client.client_id);
    expect(introspection.sub).toBe(verifiedIdToken.payload.sub);

    const userInfoResponse = await getAuth("/oauth2/userinfo", {
      authorization: `Bearer ${tokens.access_token}`,
    });
    expect(userInfoResponse.status).toBe(200);
    const userInfo = (await userInfoResponse.json()) as { sub?: string; email?: string };
    expect(userInfo.sub).toBe(verifiedIdToken.payload.sub);
    expect(userInfo.email).toBe(accountEmail);

    const refreshResponse = await postAuthForm(
      "/oauth2/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
      clientAuthorization,
    );
    expect(refreshResponse.status).toBe(200);
    const refreshed = (await refreshResponse.json()) as { refresh_token: string };
    expect(refreshed.refresh_token === tokens.refresh_token).toBe(false);

    const refreshedIntrospectionResponse = await postAuthForm(
      "/oauth2/introspect",
      new URLSearchParams({
        token: refreshed.refresh_token,
        token_type_hint: "refresh_token",
      }),
      clientAuthorization,
    );
    expect(refreshedIntrospectionResponse.status).toBe(200);
    expect(((await refreshedIntrospectionResponse.json()) as { active?: boolean }).active).toBe(
      true,
    );

    const revocationResponse = await postAuthForm(
      "/oauth2/revoke",
      new URLSearchParams({
        token: refreshed.refresh_token,
      }),
      clientAuthorization,
    );
    expect(revocationResponse.status).toBe(200);

    const revokedIntrospectionResponse = await postAuthForm(
      "/oauth2/introspect",
      new URLSearchParams({
        token: refreshed.refresh_token,
        token_type_hint: "refresh_token",
      }),
      clientAuthorization,
    );
    expect(revokedIntrospectionResponse.status).toBe(200);
    expect(((await revokedIntrospectionResponse.json()) as { active?: boolean }).active).toBe(
      false,
    );
    expect(
      await database
        .prepare(
          "SELECT count(*) AS count FROM oauth_refresh_token WHERE client_id = ? AND revoked IS NULL",
        )
        .bind(client.client_id)
        .first<number>("count"),
    ).toBe(0);

    await database
      .prepare("UPDATE oauth_client SET disabled = 1 WHERE client_id = ?")
      .bind(client.client_id)
      .run();
    const disabledUserInfoResponse = await getAuth("/oauth2/userinfo", {
      authorization: `Bearer ${tokens.access_token}`,
    });
    expect(disabledUserInfoResponse.status).toBe(401);

    await database
      .prepare("UPDATE oauth_client SET disabled = 0 WHERE client_id = ?")
      .bind(client.client_id)
      .run();
    const restoredUserInfoResponse = await getAuth("/oauth2/userinfo", {
      authorization: `Bearer ${tokens.access_token}`,
    });
    expect(restoredUserInfoResponse.status).toBe(200);
  });

  test("revokes pending authorization codes with an account application authorization", async () => {
    const ownerId = await createVerifiedAccount("owner-revoke@example.com", "admin");
    const accountId = await createVerifiedAccount("account-revoke@example.com");
    const now = Date.now();

    await database.batch([
      database
        .prepare(
          "INSERT INTO oauth_client (id, client_id, user_id, redirect_uris, name) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          "client-row-revoke",
          "client-revoke",
          ownerId,
          '["https://client.example/callback"]',
          "Client",
        ),
      database
        .prepare(
          "INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "refresh-row-revoke",
          "ea_rt_revoke",
          "client-revoke",
          accountId,
          now + 60_000,
          now,
          '["openid","offline_access"]',
        ),
      database
        .prepare(
          "INSERT INTO oauth_access_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "access-row-revoke",
          "ea_at_revoke",
          "client-revoke",
          accountId,
          now + 60_000,
          now,
          '["openid"]',
        ),
      database
        .prepare(
          "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("consent-row-revoke", "client-revoke", accountId, '["openid"]', now, now),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "verification-revoke",
          "authorization-code-revoke",
          JSON.stringify({
            type: "authorization_code",
            userId: accountId,
            query: { client_id: "client-revoke" },
          }),
          now + 60_000,
          now,
          now,
        ),
      database
        .prepare(
          "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "verification-revoke-unrelated",
          "authorization-code-revoke-unrelated",
          JSON.stringify({
            type: "authorization_code",
            userId: accountId,
            query: { client_id: "other-client" },
          }),
          now + 60_000,
          now,
          now,
        ),
    ]);

    await revokeApplicationAuthorizationAtomically(database, {
      accountId,
      clientId: "client-revoke",
    });

    expect(
      await database
        .prepare(
          "SELECT (SELECT count(*) FROM oauth_access_token WHERE user_id = ? AND client_id = ?) + (SELECT count(*) FROM oauth_refresh_token WHERE user_id = ? AND client_id = ?) + (SELECT count(*) FROM oauth_consent WHERE user_id = ? AND client_id = ?) AS count",
        )
        .bind(accountId, "client-revoke", accountId, "client-revoke", accountId, "client-revoke")
        .first<number>("count"),
    ).toBe(0);
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM verification WHERE id = ?")
        .bind("verification-revoke")
        .first<number>("count"),
    ).toBe(0);
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM verification WHERE id = ?")
        .bind("verification-revoke-unrelated")
        .first<number>("count"),
    ).toBe(1);
  });

  test("blocks generic banned-state updates without changing OAuth state", async () => {
    const adminEmail = "admin-ban@example.com";
    const targetEmail = "target-ban@example.com";
    const adminId = await createVerifiedAccount(adminEmail, "admin");
    const targetId = await createVerifiedAccount(targetEmail);
    const cookie = await signInCookie(adminEmail);
    const now = Date.now();

    await database.batch([
      database
        .prepare(
          "INSERT INTO oauth_client (id, client_id, user_id, redirect_uris, name) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          "client-row-ban",
          "client-ban",
          adminId,
          '["https://client.example/callback"]',
          "Client",
        ),
      database
        .prepare(
          "INSERT INTO oauth_refresh_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "refresh-row-ban",
          "ea_rt_test",
          "client-ban",
          targetId,
          now + 60_000,
          now,
          '["openid","offline_access"]',
        ),
      database
        .prepare(
          "INSERT INTO oauth_access_token (id, token, client_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "access-row-ban",
          "ea_at_test",
          "client-ban",
          targetId,
          now + 60_000,
          now,
          '["openid"]',
        ),
      database
        .prepare(
          "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("consent-row-ban", "client-ban", targetId, '["openid"]', now, now),
    ]);

    const response = await postAuth(
      "/admin/update-user",
      { userId: targetId, data: { banned: true, banReason: "Security event" } },
      cookie,
    );

    expect(response.status).toBe(403);
    expect((await response.json()) as unknown).toEqual({
      code: "ADMIN_PLUGIN_ENDPOINT_PROHIBITED",
      message: "Use the Easy Auth administrator interface",
    });
    expect(
      await database
        .prepare(
          "SELECT (SELECT count(*) FROM oauth_access_token WHERE user_id = ?) + (SELECT count(*) FROM oauth_refresh_token WHERE user_id = ?) AS count",
        )
        .bind(targetId, targetId)
        .first<number>("count"),
    ).toBe(2);
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM oauth_consent WHERE user_id = ?")
        .bind(targetId)
        .first<number>("count"),
    ).toBe(1);
  });
});
