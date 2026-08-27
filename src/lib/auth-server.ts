import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth";

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  return auth.api.getSession({
    headers: getRequestHeaders(),
  });
});

export const fetchSignInMethods = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return { session: null, accounts: [] };
  }

  const accounts = await auth.api.listUserAccounts({ headers });
  return { session, accounts };
});
