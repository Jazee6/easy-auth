import { createFileRoute, redirect } from "@tanstack/react-router";

import { TwoFactorChallengeForm } from "@/components/two-factor-challenge-form";
import { getPostLoginRedirect } from "@/lib/auth-policy";
import { fetchAuthoritativeSession } from "@/lib/auth-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/two-factor")({
  head: () => privatePageHead("Two-factor authentication"),
  beforeLoad: async () => {
    const session = await fetchAuthoritativeSession();
    if (session?.session) {
      throw redirect({ to: getPostLoginRedirect() });
    }
  },
  component: TwoFactorChallengePage,
});

function TwoFactorChallengePage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <TwoFactorChallengeForm />
      </div>
    </div>
  );
}
