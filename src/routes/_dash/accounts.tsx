import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@/lib/auth.ts";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useState } from "react";
import { authClient } from "@/lib/auth-client.ts";
import GithubMark from "@/assets/github-mark.svg";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { appName } from "@/lib/constants.ts";

export const listUserAccounts = createServerFn().handler(() => {
  return auth.api.listUserAccounts({
    headers: getRequestHeaders(),
  });
});

export const Route = createFileRoute("/_dash/accounts")({
  component: RouteComponent,
  staticData: {
    title: "Accounts",
  },
  head: () => ({
    meta: [
      {
        title: `Accounts - ${appName}`,
      },
      {
        name: "description",
        content: `Manage your accounts on ${appName}.`,
      },
    ],
  }),
  loader: async () => ({
    accounts: await listUserAccounts(),
  }),
});

function RouteComponent() {
  const { accounts } = Route.useLoaderData();
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  const onUnlink = async () => {
    setUnlinkLoading(true);
    await authClient
      .unlinkAccount({
        providerId: "github",
      })
      .finally(() => setUnlinkLoading(false));
  };

  const onLink = async () => {
    await authClient.linkSocial({
      provider: "github",
      callbackURL: "/accounts",
    });
  };

  const github = accounts?.find((i) => i.providerId === "github");

  return (
    <div className="max-w-3xl mx-auto">
      <Item variant="outline">
        {/*TODO Email change / delete user / verify*/}
        <ItemMedia variant="image">
          <img src={GithubMark} alt="github logo" width={32} height={32} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Github</ItemTitle>
          {github?.updatedAt ? (
            <ItemDescription suppressHydrationWarning>
              {new Date(github.updatedAt).toLocaleString()}
            </ItemDescription>
          ) : null}
        </ItemContent>
        <ItemActions>
          {github ? (
            <Button
              variant="secondary"
              onClick={onUnlink}
              disabled={unlinkLoading}
            >
              {unlinkLoading && <Spinner />}
              Unlink
            </Button>
          ) : (
            <Button onClick={onLink}>Link</Button>
          )}
        </ItemActions>
      </Item>
    </div>
  );
}
