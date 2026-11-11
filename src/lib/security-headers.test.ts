import { describe, expect, test } from "bun:test";

import { STRICT_TRANSPORT_SECURITY, withSecurityHeaders } from "./security-headers";

describe("Security headers", () => {
  test("adds the baseline headers and HSTS on HTTPS", async () => {
    const response = withSecurityHeaders(
      new Request("https://account.example/login"),
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("strict-transport-security")).toBe(STRICT_TRANSPORT_SECURITY);
    expect(await response.text()).toBe("<html></html>");
  });

  test("keeps headers set by the route and skips HSTS on plain HTTP", () => {
    const response = withSecurityHeaders(
      new Request("http://localhost:3000/api/auth/jwks"),
      new Response("{}", {
        status: 201,
        headers: { "referrer-policy": "no-referrer", "access-control-allow-origin": "*" },
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  test("preserves multiple Set-Cookie headers", () => {
    const headers = new Headers();
    headers.append("set-cookie", "ea.session_token=a; Path=/; HttpOnly");
    headers.append("set-cookie", "ea.session_data=b; Path=/; HttpOnly");
    const response = withSecurityHeaders(
      new Request("https://account.example/api/auth/sign-in/email"),
      new Response(null, { headers }),
    );
    expect(response.headers.getSetCookie().length).toBe(2);
  });
});
