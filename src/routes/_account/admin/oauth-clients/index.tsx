import { createFileRoute } from "@tanstack/react-router";

import { OAuthClients } from "@/components/oauth-clients";
import { listOAuthClients } from "@/lib/oauth-server";

export const Route = createFileRoute("/_account/admin/oauth-clients/")({
  staticData: { title: "OAuth clients" },
  loader: () => listOAuthClients(),
  component: OAuthClientsPage,
});

function OAuthClientsPage() {
  const clients = Route.useLoaderData();
  return <OAuthClients clients={clients} />;
}
