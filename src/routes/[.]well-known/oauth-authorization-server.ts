import { createFileRoute } from "@tanstack/react-router";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/auth";

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: ({ request }) => oauthProviderAuthServerMetadata(auth)(request),
    },
  },
});
