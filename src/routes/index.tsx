import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";

export const getSession = createServerFn().handler(async () => {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });
  if (!session) {
    throw redirect({ to: "/login" });
  }
  return {
    session,
  };
});

export const Route = createFileRoute("/")({
  beforeLoad: () => getSession(),
  loader: () => {
    throw redirect({ to: "/profile" });
  },
});
