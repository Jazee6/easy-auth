import { adminClient, oidcClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";

export const authClient = createAuthClient({
  fetchOptions: {
    onError: (ctx) => {
      toast.error(ctx.error.message);
    },
  },
  plugins: [adminClient(), oidcClient()],
});

export const { useSession } = authClient;

export type Session = typeof authClient.$Infer.Session;
