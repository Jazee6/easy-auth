import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { SignInMethods } from "@/components/sign-in-methods";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getRouteRedirect } from "@/lib/auth-policy";
import { fetchSignInMethods } from "@/lib/auth-server";

interface SignInMethodsSearch {
  status?: string;
  error?: string;
}

export const Route = createFileRoute("/sign-in-methods")({
  validateSearch: (search: Record<string, unknown>): SignInMethodsSearch => ({
    ...(typeof search.status === "string" ? { status: search.status } : {}),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
  }),
  beforeLoad: async () => {
    const data = await fetchSignInMethods();
    const redirectPath = getRouteRedirect({
      pathname: "/sign-in-methods",
      hasSession: Boolean(data.session?.session),
    });

    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }

    return { signInMethods: data };
  },
  loader: ({ context }) => context.signInMethods,
  component: SignInMethodsPage,
});

function SignInMethodsPage() {
  const { session, accounts } = Route.useLoaderData();
  const { status, error } = Route.useSearch();
  const user = session!.user;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>Sign-in methods</span>
          </div>
        </header>
        <main className="flex flex-1 justify-center p-6 md:p-8">
          <SignInMethods user={user} accounts={accounts} status={status} error={error} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
