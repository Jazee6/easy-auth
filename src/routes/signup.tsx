import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSession } from "@/lib/auth-server";
import { getRouteRedirect } from "@/lib/auth-policy";
import { SignupForm } from "@/components/signup-form";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const session = await fetchSession();
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
