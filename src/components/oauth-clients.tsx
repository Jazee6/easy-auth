import { Link } from "@tanstack/react-router";

import { CreateOAuthClientDialog } from "@/components/create-oauth-client-dialog";
import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

export interface OAuthClientListItem {
  clientId: string;
  name: string | null;
  applicationType: string | null;
  tokenEndpointAuthMethod: string | null;
  redirectUris: string[];
  disabled: boolean | null;
  createdAt: Date | null;
}

export function OAuthClients({ clients }: { clients: OAuthClientListItem[] }) {
  const columns: DataTableColumnDef<OAuthClientListItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link
          to="/admin/oauth-clients/$clientId"
          params={{ clientId: row.original.clientId }}
          className="font-medium hover:underline"
        >
          {row.original.name || "Unnamed application"}
        </Link>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) =>
        `${row.original.applicationType} / ${row.original.tokenEndpointAuthMethod === "none" ? "public" : "confidential"}`,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (row.original.disabled ? "Disabled" : "Enabled"),
    },
    {
      accessorKey: "clientId",
      header: "Client ID",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.clientId}</span>,
    },
  ];

  return (
    <div className="w-full max-w-5xl space-y-6">
      <PageHeader
        title="OAuth clients"
        description="Only clients created by your administrator account are shown."
        actions={<CreateOAuthClientDialog />}
      />
      <DataTable data={clients} columns={columns} emptyMessage="No OAuth clients registered." />
    </div>
  );
}
