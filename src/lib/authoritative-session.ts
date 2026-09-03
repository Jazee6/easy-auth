import type { createEasyAuth } from "./auth-factory";

type SessionAuthApi = Pick<ReturnType<typeof createEasyAuth>["api"], "getSession">;

export function getAuthoritativeSession(authApi: SessionAuthApi, headers: Headers) {
  return authApi.getSession({
    headers,
    query: { disableCookieCache: true },
  });
}
