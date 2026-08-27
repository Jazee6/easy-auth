import { createFileRoute, redirect } from "@tanstack/react-router";
import * as v from "valibot";
import { fetchSession } from "@/lib/auth-server";
import { getRouteRedirect, normalizeEmail } from "@/lib/auth-policy";
import { VerifyEmailForm } from "@/components/verify-email-form";

const searchSchema = v.object({
  email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search) => {
    const result = v.safeParse(searchSchema, search);
    return result.success && result.output.email
      ? { email: normalizeEmail(result.output.email) }
      : {};
  },
  beforeLoad: async () => {
    const session = await fetchSession();
    const redirectPath = getRouteRedirect({
      pathname: "/verify-email",
      hasSession: Boolean(session?.session),
    });

    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <VerifyEmailForm initialEmail={email} />
      </div>
    </div>
  );
}
