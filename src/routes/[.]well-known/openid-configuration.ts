import { createFileRoute } from "@tanstack/react-router";
import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth";

export const Route = createFileRoute("/.well-known/openid-configuration")({
  server: {
    handlers: {
      GET: ({ request }) => oauthProviderOpenIdConfigMetadata(auth)(request),
    },
  },
});
