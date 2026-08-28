import { createFileRoute } from "@tanstack/react-router";

import { ProfileForm } from "@/components/profile-form";

export const Route = createFileRoute("/_account/profile")({
  staticData: {
    title: "Profile",
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { session } = Route.useRouteContext();

  return <ProfileForm user={session.user} />;
}
