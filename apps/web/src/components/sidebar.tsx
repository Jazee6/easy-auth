import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ChevronUp, Home, LayoutGrid, Link as LinkIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { User } from "@/lib/types.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import useSWRMutation from "swr/mutation";
import { get } from "@/lib/request.ts";

const adminItems = [
  {
    title: "应用",
    url: "/apps",
    icon: LayoutGrid,
  },
];

const AdminSideBar = () => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>管理</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {adminItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.url}
              >
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

const items = [
  {
    title: "首页",
    url: "/",
    icon: Home,
  },
  {
    title: "关联",
    url: "/link",
    icon: LinkIcon,
  },
];

export function AppSidebar({ user }: { user?: User }) {
  const location = useLocation();
  const nav = useNavigate();
  const { trigger, isMutating } = useSWRMutation("/logout", get);

  const { avatar, nickname, email } = user ?? {};

  const onLogout = async () => {
    await trigger();
    nav("/login");
  };

  return (
    <Sidebar collapsible="icon">
      {/*<SidebarHeader />*/}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>我的账号</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.scope === "admin" && <AdminSideBar />}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar>
                    <AvatarImage
                      src={avatar ? avatar : undefined}
                      alt="avatar"
                    />
                    <AvatarFallback>EA</AvatarFallback>
                  </Avatar>

                  <span className="ml-1">
                    {nickname || email || (
                      <Skeleton className="w-full h-full" />
                    )}
                  </span>

                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top">
                {user?.email && (
                  <>
                    <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={onLogout} disabled={isMutating}>
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
