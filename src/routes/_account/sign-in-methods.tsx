import { createFileRoute } from "@tanstack/react-router";

import { SignInMethods } from "@/components/sign-in-methods";
import { fetchAccountSignInMethods } from "@/lib/auth-server";

interface SignInMethodsSearch {
  status?: string;
  error?: string;
}

export const Route = createFileRoute("/_account/sign-in-methods")({
  validateSearch: (search: Record<string, unknown>): SignInMethodsSearch => ({
    ...(typeof search.status === "string" ? { status: search.status } : {}),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
  }),
  staticData: {
    title: "Sign-in methods",
  },
  loader: () => fetchAccountSignInMethods(),
  component: SignInMethodsPage,
});

function SignInMethodsPage() {
  const accounts = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const { status, error } = Route.useSearch();

  return <SignInMethods user={session.user} accounts={accounts} status={status} error={error} />;
}
