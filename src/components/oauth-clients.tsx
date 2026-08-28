import { Link, useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";
import { useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumnDef } from "@/components/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clientRegistrationSchema, translateOAuthManagementError } from "@/lib/oauth-policy";
import { createOAuthClient } from "@/lib/oauth-server";

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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ clientId: string; value: string } | null>(null);
  const form = useForm({
    defaultValues: {
      name: "",
      applicationType: "web" as "web" | "native",
      authentication: "confidential" as "confidential" | "public",
      redirectUris: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = v.safeParse(clientRegistrationSchema, value);
      if (!parsed.success) {
        setError(parsed.issues[0]?.message ?? "Check the client configuration.");
        return;
      }
      try {
        const result = await createOAuthClient({ data: parsed.output });
        setSecret(
          result.clientSecret ? { clientId: result.clientId, value: result.clientSecret } : null,
        );
        form.reset();
        await router.invalidate();
      } catch (cause) {
        setError(translateOAuthManagementError(cause));
      }
    },
  });

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
    <div className="grid w-full max-w-5xl gap-6">
      {secret && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Save this client secret now</CardTitle>
            <CardDescription>
              It is shown once and cannot be recovered. Losing it requires immediate rotation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">
              {secret.value}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(secret.value)}
              >
                <Copy className="size-4" /> Copy secret
              </Button>
              <Button type="button" onClick={() => setSecret(null)}>
                I have saved it
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Register a trusted application</CardTitle>
          <CardDescription>
            Authorization Code with S256 PKCE is required for every client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              {error && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              <form.Field name="name">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="client-name">Application name</FieldLabel>
                    <Input
                      id="client-name"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      required
                    />
                    {field.state.meta.errors[0] && (
                      <FieldError>{String(field.state.meta.errors[0])}</FieldError>
                    )}
                  </Field>
                )}
              </form.Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="applicationType">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="application-type">Application type</FieldLabel>
                      <select
                        id="application-type"
                        className="h-9 rounded-md border bg-transparent px-3 text-sm"
                        value={field.state.value}
                        onChange={(event) => {
                          const value = event.target.value as "web" | "native";
                          field.handleChange(value);
                          if (value === "native") form.setFieldValue("authentication", "public");
                        }}
                      >
                        <option value="web">Web</option>
                        <option value="native">Native</option>
                      </select>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="authentication">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="authentication">Authentication</FieldLabel>
                      <select
                        id="authentication"
                        className="h-9 rounded-md border bg-transparent px-3 text-sm"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value as "confidential" | "public")
                        }
                        disabled={form.getFieldValue("applicationType") === "native"}
                      >
                        <option value="confidential">Confidential</option>
                        <option value="public">Public</option>
                      </select>
                      <FieldDescription>
                        Native applications are always public and never receive a secret.
                      </FieldDescription>
                    </Field>
                  )}
                </form.Field>
              </div>
              <form.Field name="redirectUris">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="redirect-uris">Redirect URIs</FieldLabel>
                    <textarea
                      id="redirect-uris"
                      className="min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
                      placeholder="https://app.example/callback"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      required
                    />
                    <FieldDescription>
                      One exact URI per line. Redirects are validated by the Authorization Server.
                    </FieldDescription>
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                    Register client
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OAuth clients</CardTitle>
          <CardDescription>
            Only clients created by your administrator account are shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable data={clients} columns={columns} emptyMessage="No OAuth clients registered." />
        </CardContent>
      </Card>
    </div>
  );
}
