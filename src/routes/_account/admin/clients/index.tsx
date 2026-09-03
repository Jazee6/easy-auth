import { createFileRoute } from "@tanstack/react-router";

import { OAuthClients } from "@/components/oauth-clients";
import { listOAuthClients } from "@/lib/oauth-server";

export const Route = createFileRoute("/_account/admin/clients/")({
  staticData: { title: "Clients" },
  loader: () => listOAuthClients(),
  component: ClientsPage,
});

function ClientsPage() {
  const clients = Route.useLoaderData();
  return <OAuthClients clients={clients} />;
}
