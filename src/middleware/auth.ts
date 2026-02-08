import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw redirect({ to: "/login" });
  }

  return next({
    context: session,
  });
});

export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw redirect({ to: "/login" });
  }

  if (session.user.role !== "admin") {
    throw redirect({ to: "/" });
  }

  return next({
    context: session,
  });
});
