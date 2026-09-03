import { Outlet, createFileRoute, redirect, useMatches } from "@tanstack/react-router";

import packageJson from "../../../package.json";
import { AppSidebar } from "@/components/app-sidebar";
import { GithubIcon } from "@/components/github-icon";
import { buttonVariants } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRouteRedirect } from "@/lib/auth-policy";
import { fetchSession } from "@/lib/auth-server";
import { privatePageHead } from "@/lib/page-metadata";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
  }
}

export const Route = createFileRoute("/_account")({
  head: () => privatePageHead("Account"),
  beforeLoad: async ({ location }) => {
    const session = await fetchSession();
    const redirectPath = getRouteRedirect({
      pathname: location.pathname,
      hasSession: Boolean(session?.session),
    });

    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }

    if (!session) {
      throw redirect({ to: "/login" });
    }

    return { session };
  },
  component: AccountLayout,
});

function AccountLayout() {
  const { session } = Route.useRouteContext();
  const title = useMatches({
    select: (matches) => {
      const activeMatch = matches.at(-1);
      return activeMatch?.staticData.title ?? "Account";
    },
  });

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{title}</span>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href="https://github.com/Jazee6/easy-auth"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View Easy Auth on GitHub"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon",
                    className: "ml-auto",
                  })}
                />
              }
            >
              <GithubIcon />
            </TooltipTrigger>
            <TooltipContent>v{packageJson.version}</TooltipContent>
          </Tooltip>
        </header>
        <main className="flex flex-1 justify-center p-6 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
