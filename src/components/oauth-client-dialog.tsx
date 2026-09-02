import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import * as v from "valibot";
import { Globe2, LockKeyhole, Plus, Smartphone, UnlockKeyhole, X } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  clientNameSchema,
  redirectUriListSchema,
  translateOAuthManagementError,
  type ClientRegistrationInput,
} from "@/lib/oauth-policy";
import { createOAuthClient, updateOAuthClient } from "@/lib/oauth-server";
import { toast } from "@/components/ui/toast";

export const clientPresets = [
  {
    value: "web-confidential",
    applicationType: "web",
    authentication: "confidential",
    title: "Web app",
    description: "Server-side. Keeps a client secret.",
  },
  {
    value: "web-public",
    applicationType: "web",
    authentication: "public",
    title: "Single-page app",
    description: "Browser only. PKCE, no secret.",
  },
  {
    value: "native-public",
    applicationType: "native",
    authentication: "public",
    title: "Native app",
    description: "Mobile or desktop. PKCE, no secret.",
  },
] as const;

export type PresetValue = (typeof clientPresets)[number]["value"];
type ApplicationType = (typeof clientPresets)[number]["applicationType"];

const presetValues = clientPresets.map((preset) => preset.value) as [PresetValue, ...PresetValue[]];

const oauthClientDialogSchema = v.pipe(
  v.object({
    name: clientNameSchema,
    preset: v.picklist(presetValues),
    applicationType: v.picklist(["web", "native"]),
    authentication: v.picklist(["confidential", "public"]),
    redirectUris: redirectUriListSchema,
  }),
  v.check(
    (input) => !(input.applicationType === "native" && input.authentication === "confidential"),
    "Native applications must be public clients.",
  ),
);

type OAuthClientDialogValue = v.InferOutput<typeof oauthClientDialogSchema>;

const redirectUriHints: Record<ApplicationType, string> = {
  web: "Exact HTTPS URIs on non-loopback hosts, e.g. https://app.example/callback.",
  native: "Claimed HTTPS URIs, exact loopback URIs, or authority-free reverse-domain schemes.",
};

export interface OAuthClientDialogClient {
  clientId: string;
  name: string | null;
  applicationType: string | null;
  tokenEndpointAuthMethod: string | null;
  redirectUris: string[];
  disabled?: boolean | null;
}

interface CreatedClient {
  clientId: string;
  name: string;
  clientSecret?: string;
}

interface OAuthClientDialogProps {
  client?: OAuthClientDialogClient;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function getPresetForClient(client?: OAuthClientDialogClient): PresetValue {
  if (client?.applicationType === "native") return "native-public";
  if (client?.tokenEndpointAuthMethod === "none") return "web-public";
  return "web-confidential";
}

function getDefaultValues(client?: OAuthClientDialogClient): OAuthClientDialogValue {
  const preset = getPresetForClient(client);
  const selectedPreset = clientPresets.find((item) => item.value === preset) ?? clientPresets[0];
  return {
    name: client?.name ?? "",
    preset,
    applicationType: client
      ? client.applicationType === "native"
        ? "native"
        : "web"
      : selectedPreset.applicationType,
    authentication: client
      ? client.tokenEndpointAuthMethod === "none"
        ? "public"
        : "confidential"
      : selectedPreset.authentication,
    redirectUris: client?.redirectUris.length ? [...client.redirectUris] : [""],
  };
}

function toRegistrationInput(value: OAuthClientDialogValue): ClientRegistrationInput {
  const preset = clientPresets.find((item) => item.value === value.preset) ?? clientPresets[0];
  return {
    name: value.name,
    applicationType: preset.applicationType,
    authentication: preset.authentication,
    redirectUris: value.redirectUris,
  };
}

export function OAuthClientDialog({
  client,
  open: controlledOpen,
  onOpenChange,
}: OAuthClientDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedClient | null>(null);
  const isEdit = Boolean(client);
  const open = controlledOpen ?? internalOpen;
  const form = useForm({
    defaultValues: getDefaultValues(client),
    validators: {
      onSubmit: oauthClientDialogSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        if (client) {
          const update = await updateOAuthClient({
            data: {
              clientId: client.clientId,
              name: value.name,
              applicationType: value.applicationType,
              authentication: value.authentication,
              redirectUris: value.redirectUris,
            },
          });
          toast.add(
            update.updated
              ? {
                  title: "OAuth client updated",
                  description: `${value.name.trim()} has been updated successfully.`,
                  type: "success",
                }
              : {
                  title: "No changes to save",
                  description: `${value.name.trim()} is already up to date.`,
                  type: "info",
                },
          );
          handleOpenChange(false);
          if (update.updated) await router.invalidate();
          return;
        }

        const created = await createOAuthClient({ data: toRegistrationInput(value) });
        setResult(created);
        toast.add({
          title: "OAuth client registered",
          description: `${created.name} is ready to request account authorization.`,
          type: "success",
        });
        await router.invalidate();
      } catch (cause) {
        setError(translateOAuthManagementError(cause));
      }
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(client));
      setError(null);
      setResult(null);
    }
  }, [client?.clientId, form, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleOpenChangeComplete(nextOpen: boolean) {
    if (nextOpen) return;
    form.reset(getDefaultValues(client));
    setError(null);
    setResult(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      {!isEdit && <DialogTrigger render={<Button />}>Register client</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <RegistrationResult result={result} />
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit OAuth client" : "Register OAuth client"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update the application name and redirect URIs. Type and authentication capability cannot be changed."
                  : "Authorization Code with S256 PKCE is required for every client."}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="mt-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              {isEdit ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Application type</FieldLabel>
                    <ClientTypeBadge applicationType={client?.applicationType} />
                  </Field>
                  <Field>
                    <FieldLabel>Authentication</FieldLabel>
                    <AuthenticationBadge authMethod={client?.tokenEndpointAuthMethod} />
                  </Field>
                </div>
              ) : (
                <form.Field name="preset">
                  {(field) => (
                    <FieldSet>
                      <FieldLegend variant="label">Client preset</FieldLegend>
                      <RadioGroup
                        name={field.name}
                        value={field.state.value}
                        onValueChange={(value) => {
                          setError(null);
                          const nextPreset = clientPresets.find((item) => item.value === value);
                          if (!nextPreset) return;
                          field.handleChange(nextPreset.value);
                          form.setFieldValue("applicationType", nextPreset.applicationType);
                          form.setFieldValue("authentication", nextPreset.authentication);
                        }}
                      >
                        {clientPresets.map((preset) => (
                          <FieldLabel key={preset.value} htmlFor={`preset-${preset.value}`}>
                            <Field orientation="horizontal">
                              <FieldContent>
                                <FieldTitle>{preset.title}</FieldTitle>
                                <FieldDescription>{preset.description}</FieldDescription>
                              </FieldContent>
                              <RadioGroupItem value={preset.value} id={`preset-${preset.value}`} />
                            </Field>
                          </FieldLabel>
                        ))}
                      </RadioGroup>
                      <FieldError errors={field.state.meta.errors} />
                    </FieldSet>
                  )}
                </form.Field>
              )}
              <form.Field name="name">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                    <FieldLabel htmlFor={isEdit ? "edit-client-name" : "client-name"}>
                      Application name
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={isEdit ? "edit-client-name" : "client-name"}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          setError(null);
                          field.handleChange(event.target.value);
                        }}
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                    </InputGroup>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="redirectUris" mode="array">
                {(field) => (
                  <FieldSet>
                    <FieldLegend variant="label">Redirect URIs</FieldLegend>
                    <form.Subscribe selector={(state) => state.values.applicationType}>
                      {(applicationType) => (
                        <FieldDescription>
                          {redirectUriHints[applicationType as ApplicationType]}
                        </FieldDescription>
                      )}
                    </form.Subscribe>
                    <div className="flex flex-col gap-3">
                      {field.state.value.map((_, index) => (
                        <form.Field key={index} name={`redirectUris[${index}]`}>
                          {(subField) => {
                            const isInvalid = subField.state.meta.errors.length > 0;
                            return (
                              <Field data-invalid={isInvalid || undefined}>
                                <InputGroup>
                                  <InputGroupInput
                                    id={`${isEdit ? "edit" : "client"}-redirect-uri-${index}`}
                                    name={subField.name}
                                    value={subField.state.value}
                                    onBlur={subField.handleBlur}
                                    onChange={(event) => {
                                      setError(null);
                                      subField.handleChange(event.target.value);
                                    }}
                                    aria-invalid={isInvalid}
                                    placeholder="https://app.example/callback"
                                  />
                                  {field.state.value.length > 1 && (
                                    <InputGroupAddon align="inline-end">
                                      <InputGroupButton
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => {
                                          setError(null);
                                          void field.removeValue(index);
                                        }}
                                        aria-label={`Remove redirect URI ${index + 1}`}
                                      >
                                        <X />
                                      </InputGroupButton>
                                    </InputGroupAddon>
                                  )}
                                </InputGroup>
                                {isInvalid && <FieldError errors={subField.state.meta.errors} />}
                              </Field>
                            );
                          }}
                        </form.Field>
                      ))}
                      <FieldError errors={field.state.meta.errors} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setError(null);
                          field.pushValue("");
                        }}
                      >
                        <Plus /> Add URI
                      </Button>
                    </div>
                  </FieldSet>
                )}
              </form.Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                    {isEdit ? "Save changes" : "Register client"}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RegistrationResult({ result }: { result: CreatedClient }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {result.clientSecret ? "Save this client secret now" : "Client registered"}
        </DialogTitle>
        <DialogDescription>
          {result.clientSecret
            ? "It is shown once and cannot be recovered. Losing it requires immediate rotation."
            : `${result.name} is ready to request account authorization.`}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Client ID</p>
          <CopyValueRow value={result.clientId} label="client ID" />
        </div>
        {result.clientSecret && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Client secret</p>
            <CopyValueRow value={result.clientSecret} label="client secret" />
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" />}>Done</DialogClose>
      </DialogFooter>
    </>
  );
}

export function CopyValueRow({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-start gap-1 rounded-md bg-muted p-3 font-mono text-sm">
      <span className="min-w-0 flex-1 break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function ClientTypeBadge({
  applicationType,
}: {
  applicationType: string | null | undefined;
}) {
  const isNative = applicationType === "native";
  const Icon = isNative ? Smartphone : Globe2;
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {isNative ? "Native" : "Web"}
    </Badge>
  );
}

export function AuthenticationBadge({ authMethod }: { authMethod: string | null | undefined }) {
  const isPublic = authMethod === "none";
  const Icon = isPublic ? UnlockKeyhole : LockKeyhole;
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {isPublic ? "Public" : "Confidential"}
    </Badge>
  );
}
