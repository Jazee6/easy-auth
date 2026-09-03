import { APIError } from "@better-auth/core/error";

import type { createEasyAuth } from "./auth-factory";
import { getAuthoritativeSession } from "./authoritative-session";
import {
  listOwnActiveSessions,
  resolveOwnedActiveSessionToken,
  type SelfServiceAccountSession,
} from "./admin-sessions";

export const ACCOUNT_SESSION_FRESH_AGE_MS = 24 * 60 * 60 * 1_000;

export const ACCOUNT_SESSION_AUTHENTICATION_REQUIRED = {
  code: "AUTHENTICATION_REQUIRED",
  message: "Authentication required",
} as const;

export const ACCOUNT_SESSION_NOT_FOUND = {
  code: "ACCOUNT_SESSION_NOT_FOUND",
  message: "Session not found",
} as const;

export const CURRENT_SESSION_SIGN_OUT_REQUIRED = {
  code: "CURRENT_SESSION_SIGN_OUT_REQUIRED",
  message: "Use Sign out to terminate the current Session",
} as const;

export const ACCOUNT_SESSION_NOT_FRESH = {
  code: "SESSION_NOT_FRESH",
  message: "Sign in again before terminating another Session",
} as const;

type AccountSessionAuthApi = Pick<
  ReturnType<typeof createEasyAuth>["api"],
  "getSession" | "revokeSession" | "revokeOtherSessions"
>;

interface AccountSessionServiceInput {
  database: D1Database;
  authApi: AccountSessionAuthApi;
  headers: Headers;
  now?: number;
}

interface CurrentSessionRow {
  created_at: number;
}

async function requireAccountSession(authApi: AccountSessionAuthApi, headers: Headers) {
  const session = await getAuthoritativeSession(authApi, headers);
  if (!session) {
    throw APIError.from("UNAUTHORIZED", ACCOUNT_SESSION_AUTHENTICATION_REQUIRED);
  }
  return session;
}

async function requireFreshAuthoritativeSession(
  database: D1Database,
  accountId: string,
  sessionId: string,
  now: number,
): Promise<void> {
  const row = await database
    .prepare("SELECT created_at FROM session WHERE id = ? AND user_id = ? AND expires_at > ?")
    .bind(sessionId, accountId, now)
    .first<CurrentSessionRow>();

  if (!row) {
    throw APIError.from("UNAUTHORIZED", ACCOUNT_SESSION_AUTHENTICATION_REQUIRED);
  }
  if (now - row.created_at >= ACCOUNT_SESSION_FRESH_AGE_MS) {
    throw APIError.from("FORBIDDEN", ACCOUNT_SESSION_NOT_FRESH);
  }
}

export async function listOwnAccountSessions({
  database,
  authApi,
  headers,
  now = Date.now(),
}: AccountSessionServiceInput): Promise<SelfServiceAccountSession[]> {
  const current = await requireAccountSession(authApi, headers);
  return listOwnActiveSessions(database, current.user.id, current.session.id, now);
}

export async function revokeOwnAccountSession({
  database,
  authApi,
  headers,
  sessionId,
  now = Date.now(),
}: AccountSessionServiceInput & { sessionId: string }): Promise<{ revoked: true }> {
  const current = await requireAccountSession(authApi, headers);
  await requireFreshAuthoritativeSession(database, current.user.id, current.session.id, now);

  const normalizedSessionId = sessionId.trim();
  if (normalizedSessionId === current.session.id) {
    throw APIError.from("BAD_REQUEST", CURRENT_SESSION_SIGN_OUT_REQUIRED);
  }

  const token = await resolveOwnedActiveSessionToken(
    database,
    current.user.id,
    normalizedSessionId,
    now,
  );
  if (!token) {
    throw APIError.from("NOT_FOUND", ACCOUNT_SESSION_NOT_FOUND);
  }

  await authApi.revokeSession({ headers, body: { token } });
  return { revoked: true };
}

export async function revokeOtherOwnAccountSessions({
  database,
  authApi,
  headers,
  now = Date.now(),
}: AccountSessionServiceInput): Promise<{ revoked: true }> {
  const current = await requireAccountSession(authApi, headers);
  await requireFreshAuthoritativeSession(database, current.user.id, current.session.id, now);
  await authApi.revokeOtherSessions({ headers });
  return { revoked: true };
}
