import { Link } from "@tanstack/react-router";
import {
  Activity,
  AppWindow,
  ArrowRight,
  Ban,
  CalendarPlus,
  LayoutDashboard,
  ShieldAlert,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SecurityActivityActionBadge } from "@/components/security-activity-table";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { AdminDashboardResult } from "@/lib/admin-dashboard";
import type { SecurityActivityItem } from "@/lib/admin-security";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ activity }: { activity: SecurityActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>No Security activity yet.</EmptyTitle>
          <EmptyDescription>
            Completed Standard Account security actions appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {activity.map((item) => (
        <Item key={item.activityId} variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>
              <SecurityActivityActionBadge action={item.action} />
              <span>{item.targetName}</span>
            </ItemTitle>
            <ItemDescription>
              {item.actorName} acted on {item.targetEmail} · {dateFormatter.format(item.createdAt)}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

export function AdminDashboard({ dashboard }: { dashboard: AdminDashboardResult }) {
  const metrics = [
    {
      title: "Accounts",
      value: dashboard.metrics.totalAccounts,
      description: "Whole Identity Domain",
      icon: Users,
    },
    {
      title: "Current Bans",
      value: dashboard.metrics.currentBans,
      description: "Effective restrictions",
      icon: Ban,
    },
    {
      title: "Active Sessions",
      value: dashboard.metrics.activeSessions,
      description: "Unexpired Sessions",
      icon: Activity,
    },
    {
      title: "Recent Accounts",
      value: dashboard.metrics.recentAccounts,
      description: "Previous rolling 7 days",
      icon: CalendarPlus,
    },
  ];

  return (
    <div className="w-full max-w-7xl space-y-8">
      <PageHeader title="Dashboard" description="Identity Domain account and security overview." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard metrics">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Security activity</CardTitle>
            <CardDescription>Latest best-effort operational history.</CardDescription>
            <CardAction>
              <Link
                to="/admin/security-activity"
                search={{ q: "", page: 1 }}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                View all
                <ArrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <RecentActivity activity={dashboard.recentActivity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Destinations</CardTitle>
            <CardDescription>Continue an administrative task.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup>
              <Item
                variant="outline"
                size="sm"
                render={
                  <Link
                    to="/admin/accounts"
                    search={{ q: "", sort: "createdAt", direction: "desc", page: 1 }}
                  />
                }
              >
                <ItemMedia variant="icon">
                  <Users />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Accounts</ItemTitle>
                  <ItemDescription>Browse the Identity Domain.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRight />
                </ItemActions>
              </Item>
              <Item variant="outline" size="sm" render={<Link to="/admin/oauth-clients" />}>
                <ItemMedia variant="icon">
                  <AppWindow />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>OAuth Clients</ItemTitle>
                  <ItemDescription>Manage clients you created.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRight />
                </ItemActions>
              </Item>
              <Item
                variant="outline"
                size="sm"
                render={<Link to="/admin/security-activity" search={{ q: "", page: 1 }} />}
              >
                <ItemMedia variant="icon">
                  <ShieldAlert />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Security activity</ItemTitle>
                  <ItemDescription>Investigate Standard Account actions.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRight />
                </ItemActions>
              </Item>
              <Item variant="outline" size="sm" render={<Link to="/admin/management-activity" />}>
                <ItemMedia variant="icon">
                  <LayoutDashboard />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Management activity</ItemTitle>
                  <ItemDescription>Review changes to clients you own.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRight />
                </ItemActions>
              </Item>
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
