import { useEffect, useRef, useState } from "react";
import { Outlet, createFileRoute, redirect, useMatches } from "@tanstack/react-router";

import packageJson from "../../../package.json";
import { AppSidebar } from "@/components/app-sidebar";
import { GithubIcon } from "@/components/github-icon";
import { buttonVariants } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
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

const HEADER_HEIGHT = 48;

function AccountLayout() {
  const { session } = Route.useRouteContext();
  const title = useMatches({
    select: (matches) => {
      const activeMatch = matches.at(-1);
      return activeMatch?.staticData.title ?? "Account";
    },
  });
  const mainRef = useRef<HTMLElement>(null);
  const [titleScrolledPast, setTitleScrolledPast] = useState(false);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const update = () => {
      const heading = main.querySelector("h1");
      setTitleScrolledPast(
        heading ? heading.getBoundingClientRect().bottom < HEADER_HEIGHT : true,
      );
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(main, { childList: true, subtree: true });
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [title]);

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <span
            aria-hidden={!titleScrolledPast}
            className={cn(
              "truncate text-sm font-semibold transition-opacity duration-200",
              titleScrolledPast ? "opacity-100" : "opacity-0",
            )}
          >
            {title}
          </span>
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
          <ThemeSwitcher />
        </header>
        <main ref={mainRef} className="flex flex-1 justify-center p-6 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
