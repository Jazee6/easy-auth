import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import {
  AuthenticationBadge,
  ClientTypeBadge,
  OAuthClientDialog,
} from "@/components/oauth-client-dialog";
import { OAuthClientActions } from "@/components/oauth-client-actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CircleCheck, CircleOff } from "lucide-react";

export interface OAuthClientListItem {
  clientId: string;
  name: string | null;
  applicationType: string | null;
  tokenEndpointAuthMethod: string | null;
  redirectUris: string[];
  disabled: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function OAuthClients({ clients }: { clients: OAuthClientListItem[] }) {
  const columns: DataTableColumnDef<OAuthClientListItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name || "Unnamed application"}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => <ClientTypeBadge applicationType={row.original.applicationType} />,
    },
    {
      id: "authentication",
      header: "Authentication",
      cell: ({ row }) => <AuthenticationBadge authMethod={row.original.tokenEndpointAuthMethod} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge disabled={Boolean(row.original.disabled)} />,
    },
    {
      accessorKey: "clientId",
      header: "Client ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs break-all">{row.original.clientId}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <OAuthClientActions client={row.original} />,
    },
  ];

  return (
    <div className="w-full max-w-7xl space-y-6">
      <PageHeader
        title="Clients"
        description="Only clients created by your administrator account are shown."
        actions={<OAuthClientDialog />}
      />
      <DataTable
        data={clients}
        columns={columns}
        emptyMessage="No OAuth clients registered."
        emptyDescription="Register a client to let a trusted application request authorization."
      />
    </div>
  );
}

function StatusBadge({ disabled }: { disabled: boolean }) {
  const Icon = disabled ? CircleOff : CircleCheck;
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {disabled ? "Disabled" : "Enabled"}
    </Badge>
  );
}
