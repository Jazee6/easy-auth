import { expect, test } from "bun:test";

import { getAuthoritativeSession } from "./authoritative-session";

test("authoritative Session reads disable the cookie cache", async () => {
  const headers = new Headers({ cookie: "ea.session_token=test" });
  let received: unknown;
  const authApi = {
    async getSession(input: unknown) {
      received = input;
      return null;
    },
  };

  await getAuthoritativeSession(authApi as never, headers);

  expect(received).toEqual({
    headers,
    query: { disableCookieCache: true },
  });
});
