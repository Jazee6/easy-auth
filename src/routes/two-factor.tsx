import { createFileRoute, redirect } from "@tanstack/react-router";

import { TwoFactorChallengeForm } from "@/components/two-factor-challenge-form";
import { getPostLoginRedirect } from "@/lib/auth-policy";
import { fetchAuthoritativeSession } from "@/lib/auth-server";
import { privatePageHead } from "@/lib/page-metadata";

interface TwoFactorSearch {
  returnTo?: string;
}

export const Route = createFileRoute("/two-factor")({
  validateSearch: (search: Record<string, unknown>): TwoFactorSearch =>
    typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {},
  head: () => privatePageHead("Two-factor authentication"),
  beforeLoad: async ({ search }) => {
    // Reauthentication must complete its challenge before returning to management.
    if (search.returnTo) return;

    const session = await fetchAuthoritativeSession();
    if (session?.session) {
      throw redirect({ to: getPostLoginRedirect() });
    }
  },
  component: TwoFactorChallengePage,
});

function TwoFactorChallengePage() {
  const { returnTo } = Route.useSearch();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <TwoFactorChallengeForm returnTo={returnTo} />
      </div>
    </div>
  );
}
