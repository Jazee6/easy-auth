import { createFileRoute, redirect } from "@tanstack/react-router";
import { appName } from "@/lib/constants.ts";
import { createServerFn } from "@tanstack/react-start";
import { oauthClient } from "@/db/schema/auth.ts";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Footer from "@/components/footer.tsx";
import { useState } from "react";
import { authClient } from "@/lib/auth-client.ts";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item.tsx";
import { cn } from "@/lib/utils.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { ChevronRight } from "lucide-react";
import { getSession } from "@/routes/index.tsx";
import { clientIdSchema, oauthSearchSchema } from "@/lib/schema.ts";

const getOAuthApp = createServerFn()
  .inputValidator(clientIdSchema)
  .handler(async ({ data }) => {
    const app = await db.query.oauthClient.findFirst({
      where: eq(oauthClient.clientId, data.client_id),
      columns: {
        id: true,
        name: true,
      },
    });
    if (!app) {
      throw redirect({ to: "/profile" });
    }
    return app;
  });

export const Route = createFileRoute("/consent")({
  component: Page,
  head: () => ({
    meta: [
      {
        title: `Consent - ${appName}`,
      },
      {
        name: "description",
        content: `${appName} consent page for authorizing other applications.`,
      },
    ],
  }),
  beforeLoad: () => getSession(),
  validateSearch: oauthSearchSchema,
  loaderDeps: ({ search }) => ({
    client_id: search.client_id,
  }),
  loader: async ({ deps, context }) => {
    return {
      app: await getOAuthApp({
        data: {
          client_id: deps.client_id,
        },
      }),
      user: context.session.user,
    };
  },
});

function Page() {
  const { app, user } = Route.useLoaderData();
  const { scope } = Route.useSearch();
  const [isLoading, setIsLoading] = useState(false);

  const onApprove = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const { data } = await authClient.oauth2
      .consent({
        accept: true,
      })
      .finally(() => setIsLoading(false));
    if (data?.redirect) {
      location.href = data.uri;
    }
  };

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Login to {app.name}</CardTitle>
            <CardDescription>
              {app.name} is requesting the following permissions:
              <ul className="flex gap-1 mt-2">
                {scope.split(" ").map((s) => (
                  <li key={s}>
                    <Badge variant="secondary">{s}</Badge>
                  </li>
                ))}
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Item
              variant="outline"
              role="listitem"
              className={cn(
                "hover:bg-secondary",
                isLoading ? "cursor-default" : "cursor-pointer",
              )}
              onClick={onApprove}
            >
              {user?.image && (
                <ItemMedia variant="image">
                  <img
                    src={user.image}
                    alt="avatar"
                    className="object-cover size-8"
                  />
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle className="line-clamp-1">{user?.name}</ItemTitle>
                <ItemDescription>{user?.email}</ItemDescription>
              </ItemContent>

              <ItemContent className="flex-none text-center">
                <ItemDescription>
                  {isLoading ? <Spinner /> : <ChevronRight />}
                </ItemDescription>
              </ItemContent>
            </Item>
          </CardContent>
        </Card>

        <Footer classname="mt-6" />
      </div>
    </main>
  );
}
