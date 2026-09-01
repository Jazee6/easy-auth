import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { formatBanDuration, type SecurityActivityItem } from "@/lib/admin-security";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const actionLabels: Record<SecurityActivityItem["action"], string> = {
  ban: "Ban",
  unban: "Unban",
  "revoke-session": "Revoke Session",
  "revoke-all-sessions": "Revoke all Sessions",
};

const columns: DataTableColumnDef<SecurityActivityItem>[] = [
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <Badge variant={row.original.action === "ban" ? "destructive" : "outline"}>
        {actionLabels[row.original.action]}
      </Badge>
    ),
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
              (row.original.action === "unban" ? "Ban removed" : "Security action completed")}
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
      <div className="min-w-44">
        <p>{row.original.actorName}</p>
        <p className="text-xs text-muted-foreground">{row.original.actorEmail}</p>
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {dateFormatter.format(new Date(row.original.createdAt))}
      </span>
    ),
  },
];

export function SecurityActivityTable({ activity }: { activity: SecurityActivityItem[] }) {
  return (
    <DataTable
      data={activity}
      columns={columns}
      emptyMessage="No Security activity"
      emptyDescription="Completed Account security operations will appear here."
    />
  );
}
