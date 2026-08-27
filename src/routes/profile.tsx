import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSession } from "@/lib/auth-server";
import { getRouteRedirect } from "@/lib/auth-policy";
import { AppSidebar } from "@/components/app-sidebar";
import { ProfileForm } from "@/components/profile-form";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    const session = await fetchSession();
    const redirectPath = getRouteRedirect({
      pathname: "/profile",
      hasSession: Boolean(session?.session),
    });

    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }

    return {
      session: session!,
    };
  },
  loader: ({ context }) => {
    return context.session;
  },
  component: ProfilePage,
});

function ProfilePage() {
  const session = Route.useLoaderData();
  const user = session.user;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>Profile</span>
          </div>
        </header>
        <main className="flex flex-1 justify-center p-6 md:p-8">
          <ProfileForm user={user} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
