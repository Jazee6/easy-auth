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
import { auth } from "./auth";

const accountIdSchema = v.object({
  accountId: v.pipe(v.string(), v.trim(), v.nonEmpty("Account ID is required")),
});

async function requireAdministrator() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Authentication required");
  assertAdministratorRouteAccess(session.user.role);
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
