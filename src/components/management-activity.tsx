import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { ActivityCell } from "@/components/oauth-client-activity";
import { RelativeTime } from "@/components/relative-time";
import { PageHeader } from "@/components/page-header";
import type { OAuthClientActivityRecord } from "@/lib/oauth-activity";

export function ManagementActivity({ activity }: { activity: OAuthClientActivityRecord[] }) {
  const columns: DataTableColumnDef<OAuthClientActivityRecord>[] = [
    {
      accessorKey: "createdAt",
      header: "When",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          <RelativeTime value={row.original.createdAt} />
        </span>
      ),
    },
    {
      accessorKey: "clientName",
      header: "Application",
      cell: ({ row }) => (
        <div className="min-w-36">
          <div>{row.original.clientName}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.clientId}</div>
        </div>
      ),
    },
    {
      id: "activity",
      header: "Activity",
      cell: ({ row }) => <ActivityCell record={row.original} />,
    },
  ];

  return (
    <div className="w-full max-w-7xl space-y-6">
      <PageHeader
        title="Management activity"
        description="Changes to OAuth clients you own. Deleted-client snapshots remain here."
      />
      <section className="space-y-4" aria-labelledby="management-activity-list-title">
        <h2 id="management-activity-list-title" className="text-lg font-semibold tracking-tight">
          Activity
        </h2>
        <DataTable data={activity} columns={columns} emptyMessage="No management activity yet." />
      </section>
    </div>
  );
}
