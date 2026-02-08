import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ReactNode, useEffect } from "react";
import { appName } from "@/lib/constants.ts";
import { BProgress } from "@bprogress/core";
// @ts-expect-error
import "@bprogress/core/css";

BProgress.configure({
  showSpinner: false,
});

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
        title: appName,
      },
      {
        name: "description",
        content: "Self-hosted Better Auth OIDC & SSO provider",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });

  useEffect(() => {
    if (isLoading) {
      BProgress.start();
    } else {
      BProgress.done();
    }
  }, [isLoading]);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Toaster position="top-center" richColors />
        {children}
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
