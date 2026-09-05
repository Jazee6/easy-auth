import { createFileRoute } from "@tanstack/react-router";

import { SignInMethods } from "@/components/sign-in-methods";
import { fetchAccountSignInMethods } from "@/lib/auth-server";
import { privatePageHead } from "@/lib/page-metadata";

interface SignInMethodsSearch {
  status?: string;
  error?: string;
  resume?: "add-passkey";
}

export const Route = createFileRoute("/_account/sign-in-methods")({
  validateSearch: (search: Record<string, unknown>): SignInMethodsSearch => ({
    ...(typeof search.status === "string" ? { status: search.status } : {}),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
    ...(search.resume === "add-passkey" ? { resume: "add-passkey" as const } : {}),
  }),
  staticData: {
    title: "Sign-in methods",
  },
  head: () => privatePageHead("Sign-in methods"),
  loader: () => fetchAccountSignInMethods(),
  component: SignInMethodsPage,
});

function SignInMethodsPage() {
  const data = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const { status, error, resume } = Route.useSearch();

  return (
    <SignInMethods
      user={session.user}
      accounts={data.accounts}
      passkeys={data.passkeys}
      status={status}
      error={error}
      resumePasskeyRegistration={resume === "add-passkey"}
    />
  );
}
