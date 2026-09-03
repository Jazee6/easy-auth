import { createFileRoute } from "@tanstack/react-router";

import { OAuthClients } from "@/components/oauth-clients";
import { listOAuthClients } from "@/lib/oauth-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/admin/clients/")({
  staticData: { title: "Clients" },
  head: () => privatePageHead("OAuth clients"),
  loader: () => listOAuthClients(),
  component: ClientsPage,
});

function ClientsPage() {
  const clients = Route.useLoaderData();
  return <OAuthClients clients={clients} />;
}
