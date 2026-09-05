import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchAuthoritativeSession } from "@/lib/auth-server";
import { getRouteRedirect } from "@/lib/auth-policy";
import { publicPageHead } from "@/lib/page-metadata";
import { LoginForm } from "@/components/login-form";

interface LoginSearch {
  error?: string;
  returnTo?: string;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    ...(typeof search.error === "string" ? { error: search.error } : {}),
    ...(typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {}),
  }),
  head: () => publicPageHead("Sign in", "/login"),
  beforeLoad: async ({ search }) => {
    if (search.returnTo) {
      return;
    }
    const session = await fetchAuthoritativeSession();
    const redirectPath = getRouteRedirect({
      pathname: "/login",
      hasSession: Boolean(session?.session),
    });

    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { error, returnTo } = Route.useSearch();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm oauthError={error} returnTo={returnTo} />
      </div>
    </div>
  );
}
