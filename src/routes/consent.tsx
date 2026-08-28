import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

import { OAuthConsent } from "@/components/oauth-consent";
import { getConsentClient } from "@/lib/oauth-server";

const searchSchema = v.object({
  client_id: v.pipe(v.string(), v.nonEmpty()),
  scope: v.optional(v.string(), ""),
});

export const Route = createFileRoute("/consent")({
  validateSearch: (search) => v.parse(searchSchema, search),
  loaderDeps: ({ search }) => ({ clientId: search.client_id }),
  loader: ({ deps }) => getConsentClient({ data: { clientId: deps.clientId } }),
  component: ConsentPage,
});

function ConsentPage() {
  const client = Route.useLoaderData();
  const { scope } = Route.useSearch();
  const scopes = [...new Set(scope.split(" ").filter(Boolean))];
  return <OAuthConsent client={client} scopes={scopes} />;
}
