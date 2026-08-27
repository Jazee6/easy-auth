import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSession } from "@/lib/auth-server";
import { getRouteRedirect } from "@/lib/auth-policy";
import { LoginForm } from "@/components/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
  beforeLoad: async () => {
    const session = await fetchSession();
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
  const { error } = Route.useSearch();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm oauthError={error} />
      </div>
    </div>
  );
}
