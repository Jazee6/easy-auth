import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchAuthoritativeSession } from "@/lib/auth-server";
import { getRouteRedirect } from "@/lib/auth-policy";
import { publicPageHead } from "@/lib/page-metadata";
import { SignupForm } from "@/components/signup-form";

export const Route = createFileRoute("/signup")({
  head: () => publicPageHead("Create account", "/signup"),
  beforeLoad: async () => {
    const session = await fetchAuthoritativeSession();
    const redirectPath = getRouteRedirect({
      pathname: "/signup",
      hasSession: Boolean(session?.session),
    });

    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }
  },
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
