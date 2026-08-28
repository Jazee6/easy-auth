import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate, useRouter } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  clientUpdateSchema,
  getOAuthManagementActionError,
  translateOAuthManagementError,
} from "@/lib/oauth-policy";
import {
  deleteOAuthClient,
  rotateOAuthClientSecret,
  setOAuthClientDisabled,
  updateOAuthClient,
} from "@/lib/oauth-server";

interface ClientDetail {
  clientId: string;
  ownerUserId: string | null;
  name: string | null;
  applicationType: string | null;
  tokenEndpointAuthMethod: string | null;
  redirectUris: string[];
  disabled: boolean | null;
  requirePKCE: boolean | null;
  grantTypes: string[];
  responseTypes: string[];
  scopes: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface AuditItem {
  id: string;
  action: string;
  summary: string;
  createdAt: Date;
}

export function OAuthClientDetail({
  client,
  activity,
}: {
  client: ClientDetail;
  activity: AuditItem[];
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      clientId: client.clientId,
      name: client.name ?? "",
      applicationType: (client.applicationType === "native" ? "native" : "web") as "web" | "native",
      redirectUris: client.redirectUris.join("\n"),
    },
    validators: {
      onSubmit: clientUpdateSchema,
    },
    onSubmit: async ({ value }) => {
      setPending("update");
      setError(null);
      try {
        await updateOAuthClient({ data: value });
        await router.invalidate();
      } catch (cause) {
        setError(translateOAuthManagementError(cause));
      } finally {
        setPending(null);
      }
    },
  });

  const toggle = async () => {
    setPending("status");
    setError(null);
    try {
      await setOAuthClientDisabled({
        data: { clientId: client.clientId, disabled: !client.disabled },
      });
      await router.invalidate();
    } catch (cause) {
      setError(getOAuthManagementActionError("status", cause));
    } finally {
      setPending(null);
    }
  };

  const rotate = async () => {
    setPending("rotate");
    setError(null);
    try {
      const result = await rotateOAuthClientSecret({ data: { clientId: client.clientId } });
      setSecret(result.clientSecret ?? null);
      await router.invalidate();
    } catch (cause) {
      setError(getOAuthManagementActionError("rotate", cause));
    } finally {
      setPending(null);
    }
  };

  const remove = async () => {
    setPending("delete");
    setError(null);
    try {
      await deleteOAuthClient({ data: { clientId: client.clientId } });
      await navigate({ to: "/admin/oauth-clients" });
    } catch (cause) {
      setError(getOAuthManagementActionError("delete", cause));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid w-full max-w-4xl gap-6">
      {error && (
        <div role="alert" className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {secret && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Save the new secret now</CardTitle>
            <CardDescription>
              The old secret stopped working immediately. This value cannot be recovered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">{secret}</div>
            <Button onClick={() => navigator.clipboard.writeText(secret)}>Copy secret</Button>
            <Button variant="outline" onClick={() => setSecret(null)}>
              I have saved it
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{client.name ?? "OAuth client"}</CardTitle>
          <CardDescription className="font-mono break-all">{client.clientId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="font-mono break-all">{client.ownerUserId ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Application type</dt>
              <dd>{client.applicationType === "native" ? "Native" : "Web"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Authentication</dt>
              <dd>{client.tokenEndpointAuthMethod === "none" ? "Public" : "Confidential"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{client.disabled ? "Disabled" : "Enabled"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PKCE</dt>
              <dd>{client.requirePKCE ? "S256 required" : "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scopes</dt>
              <dd>{client.scopes.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>
                {client.createdAt ? new Date(client.createdAt).toLocaleString() : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>
                {client.updatedAt ? new Date(client.updatedAt).toLocaleString() : "Unavailable"}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <ConfirmAction
              label={client.disabled ? "Enable" : "Disable"}
              title={`${client.disabled ? "Enable" : "Disable"} ${client.name ?? client.clientId}?`}
              description={
                client.disabled
                  ? "New authorization and client authentication will be allowed again."
                  : "New authorization, token exchange, refresh, and client authentication will fail until re-enabled."
              }
              pending={pending === "status"}
              disabled={Boolean(pending)}
              onConfirm={toggle}
            />
            {client.tokenEndpointAuthMethod !== "none" && (
              <ConfirmAction
                label="Rotate secret"
                title="Rotate this client secret?"
                description="The previous secret will stop working immediately. The replacement is shown once."
                pending={pending === "rotate"}
                disabled={Boolean(pending)}
                onConfirm={rotate}
              />
            )}
            <ConfirmAction
              destructive
              label="Delete permanently"
              title={`Permanently delete ${client.name ?? client.clientId}?`}
              description="The OAuth client, its Application Authorizations, refresh tokens, access tokens, and dependent provider state will be removed. Management activity is retained."
              pending={pending === "delete"}
              disabled={Boolean(pending)}
              onConfirm={remove}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Authentication capability is immutable. Register a new client to change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name" validators={{ onBlur: clientUpdateSchema.entries.name }}>
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                    <FieldLabel htmlFor="detail-name">Application name</FieldLabel>
                    <Input
                      id="detail-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                    )}
                  </Field>
                )}
              </form.Field>
              <form.Field name="applicationType">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="detail-type">Application type</FieldLabel>
                    <select
                      id="detail-type"
                      className="h-9 rounded-md border bg-transparent px-3 text-sm"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value as "web" | "native")
                      }
                    >
                      <option value="web">Web</option>
                      <option value="native" disabled={client.tokenEndpointAuthMethod !== "none"}>
                        Native
                      </option>
                    </select>
                  </Field>
                )}
              </form.Field>
              <form.Field
                name="redirectUris"
                validators={{ onBlur: clientUpdateSchema.entries.redirectUris }}
              >
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                    <FieldLabel htmlFor="detail-redirects">Redirect URIs</FieldLabel>
                    <textarea
                      id="detail-redirects"
                      className="min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                    )}
                  </Field>
                )}
              </form.Field>
              <Button type="submit" loading={pending === "update"} disabled={Boolean(pending)}>
                Save changes
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Management timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="border-l pl-4 text-sm">
                <p className="font-medium">{item.action}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <p className="font-mono text-xs">{item.summary}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmAction({
  label,
  title,
  description,
  pending,
  disabled,
  destructive = false,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  pending: boolean;
  disabled: boolean;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant={destructive ? "destructive" : "outline"} disabled={disabled} />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
