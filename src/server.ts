import handler from "@tanstack/react-start/server-entry";

import { purgeExpiredAuthData } from "./lib/maintenance";
import { withSecurityHeaders } from "./lib/security-headers";

export default {
  async fetch(request) {
    return withSecurityHeaders(request, await handler.fetch(request));
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      purgeExpiredAuthData(env.DB, Date.now()).then((result) => {
        console.log("Purged expired auth data", result);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
