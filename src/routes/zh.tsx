import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing-page";
import { fetchHasSession } from "@/lib/auth-server";
import { landingPageHead } from "@/lib/landing-content";

export const Route = createFileRoute("/zh")({
  head: () => landingPageHead("zh"),
  loader: () => fetchHasSession(),
  component: ChineseLandingPage,
});

function ChineseLandingPage() {
  return <LandingPage locale="zh" hasSession={Route.useLoaderData()} />;
}
