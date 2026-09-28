import * as v from "valibot";

/**
 * The OAuth Provider renders unstyled HTML for RP-Initiated Logout pages
 * (confirmation, signed out, error). Easy Auth replaces those bodies with a
 * redirect to its own `/logout` page while keeping every cookie the provider
 * set, including the signed logout confirmation state.
 */

export const logoutSteps = ["confirm", "signed-out", "error"] as const;
export type LogoutStep = (typeof logoutSteps)[number];

export const logoutSearchSchema = v.object({
  step: v.optional(v.picklist(logoutSteps), "error"),
  unregistered: v.optional(v.literal(true)),
});

export type LogoutSearch = v.InferOutput<typeof logoutSearchSchema>;

export const LOGOUT_CONFIRM_ACTION = "/api/auth/oauth2/end-session/confirm";

const logoutPaths = new Set([
  "/api/auth/oauth2/end-session",
  "/api/auth/oauth2/end-session/confirm",
]);

/** Classifies the provider's logout HTML by the data attributes it renders. */
export function classifyLogoutPage(html: string): LogoutSearch {
  if (html.includes("data-oidc-logout-confirmation")) return { step: "confirm" };
  if (html.includes('data-oidc-logout-state="logged-out"')) {
    return html.includes("post-logout redirect was not registered")
      ? { step: "signed-out", unregistered: true }
      : { step: "signed-out" };
  }
  return { step: "error" };
}

export function getLogoutPageUrl(search: LogoutSearch): string {
  const query = new URLSearchParams({ step: search.step });
  if (search.unregistered) query.set("unregistered", "true");
  return `/logout?${query.toString()}`;
}

export async function presentLogoutResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (!logoutPaths.has(new URL(request.url).pathname)) return response;
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const headers = new Headers({
    location: getLogoutPageUrl(classifyLogoutPage(await response.text())),
    "cache-control": "no-store",
  });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  // 303 turns the confirmation form POST into a GET of the page.
  return new Response(null, { status: 303, headers });
}
