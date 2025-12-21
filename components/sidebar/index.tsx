import {
  CircleUser,
  KeyRound,
  LayoutGrid,
  Lock,
  UserRoundPen,
  UserRoundSearch,
} from "lucide-react";
import { type ComponentProps } from "react";
import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Session } from "@/lib/auth-client";
import Link from "next/link";

export const sidebar = {
  navMain: [
    {
      title: "Profile",
      url: "/profile",
      icon: <UserRoundPen />,
    },
    {
      title: "Accounts",
      url: "/accounts",
      icon: <CircleUser />,
    },
    {
      title: "Auth",
      url: "/auth",
      icon: <Lock />,
    },
    {
      title: "Sessions",
      url: "/sessions",
      icon: <KeyRound />,
    },
  ],
  admin: [
    {
      title: "Users",
      url: "/users",
      icon: <UserRoundSearch />,
    },
    {
      title: "Apps",
      url: "/apps",
      icon: <LayoutGrid />,
    },
  ],
};

export default function Index({
  session,
  ...props
}: ComponentProps<typeof Sidebar> & {
  session: Session;
}) {
  const isAdmin = session.user.role === "admin";

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <span className="text-base font-semibold">Easy Auth</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebar.navMain} />

        {isAdmin && <NavMain items={sidebar.admin} groupLabel="admin" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: session.user.name,
            email: session.user.email,
            avatar: session.user.image,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
