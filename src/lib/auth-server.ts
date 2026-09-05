import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as v from "valibot";

import { db } from "@/db";
import {
  listOwnAccountSessions,
  revokeOtherOwnAccountSessions,
  revokeOwnAccountSession,
} from "./account-session-service";
import { auth } from "./auth";
import { getAuthoritativeSession } from "./authoritative-session";
import { getOwnTwoFactorStatus } from "./two-factor-management";

const sessionIdSchema = v.object({
  sessionId: v.pipe(v.string(), v.trim(), v.nonEmpty("Session ID is required")),
});

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  return auth.api.getSession({
    headers: getRequestHeaders(),
  });
});

export const fetchAuthoritativeSession = createServerFn({ method: "GET" }).handler(async () => {
  return getAuthoritativeSession(auth.api, getRequestHeaders());
});

export const fetchAccountSignInMethods = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await getAuthoritativeSession(auth.api, headers);
  if (!session) throw new Error("Authentication required");
  const accounts = await auth.api.listUserAccounts({ headers });
  const passkeys = await auth.api.listPasskeys({ headers });
  return { accounts, passkeys };
});

export const fetchAccountSessions = createServerFn({ method: "GET" }).handler(async () => {
  return listOwnAccountSessions({
    database: db.$client,
    authApi: auth.api,
    headers: getRequestHeaders(),
  });
});

export const fetchTwoFactorStatus = createServerFn({ method: "GET" }).handler(async () => {
  return getOwnTwoFactorStatus({
    database: db.$client,
    authApi: auth.api,
    headers: getRequestHeaders(),
  });
});

export const revokeAccountOwnedSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(sessionIdSchema, input))
  .handler(async ({ data }) => {
    return revokeOwnAccountSession({
      database: db.$client,
      authApi: auth.api,
      headers: getRequestHeaders(),
      sessionId: data.sessionId,
    });
  });

export const revokeOtherAccountSessions = createServerFn({ method: "POST" }).handler(async () => {
  return revokeOtherOwnAccountSessions({
    database: db.$client,
    authApi: auth.api,
    headers: getRequestHeaders(),
  });
});
