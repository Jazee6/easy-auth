import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { buildRobotsTxt } from "@/lib/crawler-files";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildRobotsTxt(env.BETTER_AUTH_URL), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        }),
    },
  },
});
