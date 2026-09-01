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
import { assertAdministratorRouteAccess } from "./admin-policy";
import {
  banAccountInputSchema,
  getBanDurationSeconds,
  listAccountSecurityActivity,
} from "./admin-security";
import { auth } from "./auth";

const accountIdSchema = v.object({
  accountId: v.pipe(v.string(), v.trim(), v.nonEmpty("Account ID is required")),
});

async function requireAdministrator() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Authentication required");
  assertAdministratorRouteAccess(session.user.role);
  return { headers, session };
}

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

export const getAccountSecurityActivity = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(accountIdSchema, input))
  .handler(async ({ data }) => {
    await requireAdministrator();
    const account = await getIdentityDomainAccount(db.$client, data.accountId);
    if (!account) return [];
    if (account.role === "administrator") {
      throw new Error("Administrator security activity is operations-only");
    }
    return listAccountSecurityActivity(db.$client, data.accountId);
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
