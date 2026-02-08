import { createFileRoute } from "@tanstack/react-router";
import { appName } from "@/lib/constants.ts";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { listUserAccounts } from "@/routes/_dash/accounts.tsx";
import ChangePassword from "@/components/change-password.tsx";

export const Route = createFileRoute("/_dash/auth")({
  component: RouteComponent,
  staticData: {
    title: "Authentication",
  },
  head: () => ({
    meta: [
      {
        title: `Authentication - ${appName}`,
      },
      {
        name: "description",
        content: `Manage your authentication settings on ${appName}.`,
      },
    ],
  }),
  loader: async () => ({
    accounts: await listUserAccounts(),
  }),
});

function RouteComponent() {
  const { accounts } = Route.useLoaderData();

  const hasCredential = accounts.find((i) => i.providerId === "credential");

  return (
    <div className="max-w-3xl mx-auto">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Password</ItemTitle>
        </ItemContent>
        <ItemActions>
          {/*TODO Set Password*/}
          <ChangePassword disabled={!hasCredential} />
        </ItemActions>
      </Item>
    </div>
  );
}
