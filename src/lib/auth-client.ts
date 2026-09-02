import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

import { getOAuthContinuationPayload, type PendingOAuthContinuation } from "./oauth-policy";
import { getTwoFactorChallengeUrl } from "./two-factor-challenge";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        if (typeof window !== "undefined") {
          window.location.assign(getTwoFactorChallengeUrl(window.location.search));
        }
      },
    }),
    oauthProviderClient(),
  ],
});

export function hasPendingOAuthFlow(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  return search.has("sig") && search.has("client_id");
}

export async function continuePendingOAuth(options?: PendingOAuthContinuation): Promise<boolean> {
  if (!hasPendingOAuthFlow()) return false;
  const result = await authClient.oauth2.continue(getOAuthContinuationPayload(options));
  if (result.error) throw new Error(result.error.message ?? "Unable to continue authorization");
  if (result.data && "url" in result.data && typeof result.data.url === "string") {
    window.location.assign(result.data.url);
    return true;
  }
  return false;
}
