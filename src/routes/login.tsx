import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSession } from "@/lib/auth-server";
import { getRouteRedirect } from "@/lib/auth-policy";
import { LoginForm } from "@/components/login-form";

export const Route = createFileRoute("/login")({
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
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
