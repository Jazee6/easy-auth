import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";
import { presentLogoutResponse } from "@/lib/logout-presentation";

async function handle({ request }: { request: Request }) {
  return presentLogoutResponse(request, await auth.handler(request));
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
