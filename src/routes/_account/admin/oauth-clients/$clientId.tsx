import { createFileRoute } from "@tanstack/react-router";

import { OAuthClientDetail } from "@/components/oauth-client-detail";
import { getOAuthClientDetail } from "@/lib/oauth-server";

export const Route = createFileRoute("/_account/admin/oauth-clients/$clientId")({
  staticData: { title: "OAuth client" },
  loader: ({ params }) => getOAuthClientDetail({ data: { clientId: params.clientId } }),
  component: OAuthClientDetailPage,
});

function OAuthClientDetailPage() {
  const detail = Route.useLoaderData();
  return <OAuthClientDetail {...detail} />;
}
