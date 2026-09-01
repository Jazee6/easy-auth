import { APIError } from "@better-auth/core/error";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as v from "valibot";

import { db } from "@/db";
import {
  getIdentityDomainAccount,
  listIdentityDomainAccounts,
  normalizeAccountListSearch,
  type AccountListSearch,
} from "./admin-accounts";
import { getAdminDashboard } from "./admin-dashboard";
import { assertAdministratorRouteAccess } from "./admin-policy";
import {
  banAccountInputSchema,
  getBanDurationSeconds,
  listAccountSecurityActivity,
  listGlobalSecurityActivity,
  normalizeSecurityActivitySearch,
  type SecurityActivitySearch,
} from "./admin-security";
import {
  ADMINISTRATOR_TARGET_PROHIBITED,
  SECURITY_ACTION_TARGET_NOT_FOUND,
  SECURITY_SESSION_NOT_FOUND,
} from "./admin-security-plugin";
import { listActiveAccountSessions, resolveActiveSessionToken } from "./admin-sessions";
import { auth } from "./auth";

const accountIdSchema = v.object({
  accountId: v.pipe(v.string(), v.trim(), v.nonEmpty("Account ID is required")),
});

const sessionIdSchema = v.object({
  accountId: accountIdSchema.entries.accountId,
  sessionId: v.pipe(v.string(), v.trim(), v.nonEmpty("Session ID is required")),
});

async function requireAdministrator() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Authentication required");
  assertAdministratorRouteAccess(session.user.role);
  return { headers, session };
}

async function requireStandardAccount(accountId: string) {
  const account = await getIdentityDomainAccount(db.$client, accountId);
  if (!account) throw APIError.from("NOT_FOUND", SECURITY_ACTION_TARGET_NOT_FOUND);
  if (account.role === "administrator") {
    throw APIError.from("FORBIDDEN", ADMINISTRATOR_TARGET_PROHIBITED);
  }
  return account;
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdministrator();
  return getAdminDashboard(db.$client);
});

export const listAccounts = createServerFn({ method: "GET" })
  .validator((input: Record<string, unknown>): AccountListSearch =>
    normalizeAccountListSearch(input),
  )
  .handler(async ({ data }) => {
    await requireAdministrator();
    return listIdentityDomainAccounts(db.$client, data);
  });

export const getAccount = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(accountIdSchema, input))
  .handler(async ({ data }) => {
    await requireAdministrator();
    return getIdentityDomainAccount(db.$client, data.accountId);
  });

export const listAccountSessions = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(accountIdSchema, input))
  .handler(async ({ data }) => {
    await requireAdministrator();
    await requireStandardAccount(data.accountId);
    return listActiveAccountSessions(db.$client, data.accountId);
  });

export const listSecurityActivity = createServerFn({ method: "GET" })
  .validator((input: Record<string, unknown>): SecurityActivitySearch =>
    normalizeSecurityActivitySearch(input),
  )
  .handler(async ({ data }) => {
    await requireAdministrator();
    return listGlobalSecurityActivity(db.$client, data);
  });

export const getAccountSecurityActivity = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(accountIdSchema, input))
  .handler(async ({ data }) => {
    await requireAdministrator();
    await requireStandardAccount(data.accountId);
    return listAccountSecurityActivity(db.$client, data.accountId);
  });

export const revokeAccountSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(sessionIdSchema, input))
  .handler(async ({ data }) => {
    const { headers } = await requireAdministrator();
    await requireStandardAccount(data.accountId);
    const sessionToken = await resolveActiveSessionToken(
      db.$client,
      data.accountId,
      data.sessionId,
    );
    if (!sessionToken) throw APIError.from("NOT_FOUND", SECURITY_SESSION_NOT_FOUND);
    await auth.api.revokeUserSession({ headers, body: { sessionToken } });
    return { revoked: true };
  });

export const revokeAllAccountSessions = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(accountIdSchema, input))
  .handler(async ({ data }) => {
    const { headers } = await requireAdministrator();
    await requireStandardAccount(data.accountId);
    await auth.api.revokeUserSessions({ headers, body: { userId: data.accountId } });
    return { revoked: true };
  });

export const unbanAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(accountIdSchema, input))
  .handler(async ({ data }) => {
    const { headers } = await requireAdministrator();
    await auth.api.unbanUser({ headers, body: { userId: data.accountId } });
    return { unbanned: true };
  });

export const banAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(banAccountInputSchema, input))
  .handler(async ({ data }) => {
    const { headers } = await requireAdministrator();
    const banExpiresIn = getBanDurationSeconds(data.duration);
    await auth.api.banUser({
      headers,
      body: {
        userId: data.accountId,
        banReason: data.reason,
        ...(banExpiresIn === undefined ? {} : { banExpiresIn }),
      },
    });
    return { banned: true };
  });
