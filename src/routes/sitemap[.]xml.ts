import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { buildSitemap } from "@/lib/crawler-files";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemap(env.BETTER_AUTH_URL), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        }),
    },
  },
});
