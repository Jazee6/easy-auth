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
import { Link } from "@tanstack/react-router";

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
  const { user } = session;
  const isAdmin = user.role === "admin";

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={
                <Link to="/">
                  <span className="text-base font-semibold">Easy Auth</span>
                </Link>
              }
            />
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
            name: user.name,
            email: user.email,
            avatar: user.image,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
