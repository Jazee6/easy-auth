import { describe, expect, test } from "bun:test";

import { classifyLogoutPage, getLogoutPageUrl, presentLogoutResponse } from "./logout-presentation";

const html = (body: string, status = 200) =>
  new Response(`<!doctype html><html><body>${body}</body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

describe("RP-Initiated Logout presentation", () => {
  test("classifies the provider's logout pages", () => {
    expect(classifyLogoutPage('<form data-oidc-logout-confirmation action="/x">')).toEqual({
      step: "confirm",
    });
    expect(classifyLogoutPage('<p data-oidc-logout-state="logged-out">Logged out.</p>')).toEqual({
      step: "signed-out",
    });
    expect(
      classifyLogoutPage(
        '<p data-oidc-logout-state="logged-out">Logged out. The requested post-logout redirect was not registered.</p>',
      ),
    ).toEqual({ step: "signed-out", unregistered: true });
    expect(classifyLogoutPage('<p data-oidc-logout-state="error">Nope</p>')).toEqual({
      step: "error",
    });
  });

  test("builds the page URL without echoing provider text", () => {
    expect(getLogoutPageUrl({ step: "confirm" })).toBe("/logout?step=confirm");
    expect(getLogoutPageUrl({ step: "signed-out", unregistered: true })).toBe(
      "/logout?step=signed-out&unregistered=true",
    );
  });

  test("redirects logout HTML to the Easy Auth page and keeps provider cookies", async () => {
    const provider = html("<form data-oidc-logout-confirmation></form>");
    provider.headers.append("set-cookie", "ea.oauth_logout_confirmation=signed; Path=/; HttpOnly");
    const response = await presentLogoutResponse(
      new Request("https://auth.example/api/auth/oauth2/end-session?client_id=x"),
      provider,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/logout?step=confirm");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([
      "ea.oauth_logout_confirmation=signed; Path=/; HttpOnly",
    ]);
  });

  test("leaves redirects, JSON, and other endpoints untouched", async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: "https://client.example/" },
    });
    const logoutRequest = new Request("https://auth.example/api/auth/oauth2/end-session");
    expect(await presentLogoutResponse(logoutRequest, redirect)).toBe(redirect);

    const json = Response.json({ message: "ok" });
    expect(await presentLogoutResponse(logoutRequest, json)).toBe(json);

    const other = html('<p data-oidc-logout-state="error"></p>');
    expect(
      await presentLogoutResponse(
        new Request("https://auth.example/api/auth/oauth2/authorize"),
        other,
      ),
    ).toBe(other);
  });
});
