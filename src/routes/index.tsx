import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing-page";
import { fetchHasSession } from "@/lib/auth-server";
import { landingPageHead } from "@/lib/landing-content";

export const Route = createFileRoute("/")({
  head: () => landingPageHead("en"),
  loader: () => fetchHasSession(),
  component: EnglishLandingPage,
});

function EnglishLandingPage() {
  return <LandingPage locale="en" hasSession={Route.useLoaderData()} />;
}
