import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  fetchOptions: {
    onError: (ctx) => {
      toast.error(ctx.error.message);
    },
  },
  plugins: [adminClient(), oauthProviderClient()],
});

export type Session = typeof authClient.$Infer.Session;
