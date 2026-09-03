import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { FileQuestionIcon } from "lucide-react";
import { useEffect } from "react";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { Toaster } from "@/components/ui/toast";
import { RouteProgress } from "@/components/route-progress";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Easy Auth",
      },
      {
        name: "robots",
        content: "noindex, nofollow",
      },
      {
        property: "og:title",
        content: "Easy Auth",
      },
      {
        property: "og:site_name",
        content: "Easy Auth",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:image",
        content: "/og-image.png",
      },
      {
        property: "og:image:type",
        content: "image/png",
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:alt",
        content: "Easy Auth",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/icon.svg",
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function NotFound() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Page not found | Easy Auth";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>The page you requested does not exist or has moved.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link data-slot="button" className={buttonVariants({ variant: "outline" })} to="/">
            Back to home
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}

function RootDocument({ children }: { children?: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children ?? <Outlet />}
        <RouteProgress />
        <Toaster />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
