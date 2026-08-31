import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

interface ActivityItem {
  id: string;
  clientId: string;
  clientName: string;
  action: string;
  summary: string;
  createdAt: Date;
}

export function ManagementActivity({ activity }: { activity: ActivityItem[] }) {
  const columns: DataTableColumnDef<ActivityItem>[] = [
    {
      accessorKey: "createdAt",
      header: "When",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "clientName",
      header: "Application",
      cell: ({ row }) => (
        <div>
          <div>{row.original.clientName}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.clientId}</div>
        </div>
      ),
    },
    { accessorKey: "action", header: "Action" },
    {
      accessorKey: "summary",
      header: "Summary",
      cell: ({ row }) => (
        <span className="max-w-sm break-words font-mono text-xs">{row.original.summary}</span>
      ),
    },
  ];
  return (
    <div className="w-full max-w-5xl space-y-6">
      <PageHeader
        title="Management activity"
        description="Application-mediated changes to OAuth clients you own. Deleted-client snapshots remain here."
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
