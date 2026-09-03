import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProfileForm } from "@/components/profile-form";
import { fetchAuthoritativeSession } from "@/lib/auth-server";
import { privatePageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/_account/profile")({
  staticData: {
    title: "Profile",
  },
  head: () => privatePageHead("Profile"),
  loader: async () => {
    const session = await fetchAuthoritativeSession();
    if (!session) throw redirect({ to: "/login" });
    return session.user;
  },
  component: ProfilePage,
});

function ProfilePage() {
  const user = Route.useLoaderData();

  return <ProfileForm user={user} />;
}
