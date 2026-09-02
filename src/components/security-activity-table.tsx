import { Ban, LockOpen, LogOut, MonitorSmartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import {
  formatBanDuration,
  SECURITY_ACTIVITY_ACTION_LABELS,
  type SecurityActivityAction,
  type SecurityActivityItem,
} from "@/lib/admin-security";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const actionIcons: Record<SecurityActivityAction, LucideIcon> = {
  ban: Ban,
  unban: LockOpen,
  "revoke-session": LogOut,
  "revoke-all-sessions": MonitorSmartphone,
};

export function SecurityActivityActionBadge({ action }: { action: SecurityActivityAction }) {
  const Icon = actionIcons[action];
  return (
    <Badge variant={action === "ban" ? "destructive" : "outline"}>
      <Icon aria-hidden="true" />
      {SECURITY_ACTIVITY_ACTION_LABELS[action]}
    </Badge>
  );
}

function IdentitySnapshot({
  name,
  email,
  accountId,
  showId = false,
}: {
  name: string;
  email: string;
  accountId: string;
  showId?: boolean;
}) {
  return (
    <div className="min-w-44">
      <p>{name}</p>
      <p className="text-xs text-muted-foreground">{email}</p>
      {showId && <p className="font-mono text-xs text-muted-foreground">{accountId}</p>}
    </div>
  );
}

function activityColumns(global: boolean): DataTableColumnDef<SecurityActivityItem>[] {
  const columns: DataTableColumnDef<SecurityActivityItem>[] = [
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <SecurityActivityActionBadge action={row.original.action} />,
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const details = row.original.details;
        return (
          <div className="min-w-48">
            <p className="font-medium">
              {details.reason ??
                (row.original.action === "unban"
                  ? "Ban removed"
                  : row.original.action === "revoke-session"
                    ? `Session ${details.sessionId ?? "revoked"}`
                    : row.original.action === "revoke-all-sessions"
                      ? "All Sessions revoked"
                      : "Security action completed")}
            </p>
            {details.duration && (
              <p className="text-xs text-muted-foreground">
                {formatBanDuration(details.duration)}
                {typeof details.expiresAt === "number"
                  ? ` · until ${dateFormatter.format(new Date(details.expiresAt))}`
                  : ""}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "actor",
      header: "Administrator",
      cell: ({ row }) => (
        <IdentitySnapshot
          name={row.original.actorName}
          email={row.original.actorEmail}
          accountId={row.original.actorAccountId}
          showId={global}
        />
      ),
    },
  ];

  if (global) {
    columns.push({
      id: "target",
      header: "Target Account",
      cell: ({ row }) => (
        <IdentitySnapshot
          name={row.original.targetName}
          email={row.original.targetEmail}
          accountId={row.original.targetAccountId}
          showId
        />
      ),
    });
  }

  columns.push({
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        <RelativeTime value={row.original.createdAt} />
      </span>
    ),
  });
  return columns;
}

export function SecurityActivityTable({
  activity,
  global = false,
}: {
  activity: SecurityActivityItem[];
  global?: boolean;
}) {
  return (
    <DataTable
      data={activity}
      columns={activityColumns(global)}
      emptyMessage="No Security activity"
      emptyDescription="Completed Account security operations will appear here."
    />
  );
}
