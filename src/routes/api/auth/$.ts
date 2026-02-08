import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const { _splat } = params;
        if (_splat === ".well-known/openid-configuration") {
          return oauthProviderOpenIdConfigMetadata(auth)(request);
        }

        return auth.handler(request);
      },
      POST: ({ request }) => auth.handler(request),
    },
  },
});
