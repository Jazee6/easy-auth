import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import * as v from "valibot";
import { Check, Copy, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { createOAuthClient } from "@/lib/oauth-server";

const clientPresets = [
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

type PresetValue = (typeof clientPresets)[number]["value"];

const presetValues = clientPresets.map((preset) => preset.value) as [PresetValue, ...PresetValue[]];

const createClientFormSchema = v.object({
  name: clientNameSchema,
  preset: v.picklist(presetValues),
  redirectUris: redirectUriListSchema,
});

type CreateClientFormValue = v.InferOutput<typeof createClientFormSchema>;

const redirectUriHints: Record<"web" | "native", string> = {
  web: "Exact HTTPS URIs on non-loopback hosts, e.g. https://app.example/callback.",
  native: "Claimed HTTPS URIs, exact loopback URIs, or authority-free reverse-domain schemes.",
};

function toRegistrationInput(value: CreateClientFormValue): ClientRegistrationInput {
  const preset = clientPresets.find((preset) => preset.value === value.preset) ?? clientPresets[0];
  return {
    name: value.name,
    applicationType: preset.applicationType,
    authentication: preset.authentication,
    redirectUris: value.redirectUris,
  };
}

interface CreatedClient {
  clientId: string;
  name: string;
  clientSecret?: string;
}

export function CreateOAuthClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedClient | null>(null);
  const form = useForm({
    defaultValues: {
      name: "",
      preset: "web-confidential" as PresetValue,
      redirectUris: [""],
    },
    validators: {
      onBlur: createClientFormSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const created = await createOAuthClient({ data: toRegistrationInput(value) });
        setResult(created);
        await router.invalidate();
      } catch (cause) {
        setError(translateOAuthManagementError(cause));
      }
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset();
      setError(null);
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>Register client</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {result ? (
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
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>Register a trusted application</DialogTitle>
              <DialogDescription>
                Authorization Code with S256 PKCE is required for every client.
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
              <form.Field name="name">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                    <FieldLabel htmlFor="client-name">Application name</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="client-name"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                    </InputGroup>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="preset">
                {(field) => (
                  <FieldSet>
                    <FieldLegend variant="label">Client type</FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as PresetValue)}
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
                  </FieldSet>
                )}
              </form.Field>
              <form.Field name="redirectUris" mode="array">
                {(field) => (
                  <FieldSet>
                    <FieldLegend variant="label">Redirect URIs</FieldLegend>
                    <form.Subscribe selector={(state) => state.values.preset}>
                      {(preset) => (
                        <FieldDescription>
                          {
                            redirectUriHints[
                              (
                                clientPresets.find((item) => item.value === preset) ??
                                clientPresets[0]
                              ).applicationType
                            ]
                          }
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
                                    id={`redirect-uri-${index}`}
                                    name={subField.name}
                                    value={subField.state.value}
                                    onBlur={subField.handleBlur}
                                    onChange={(event) => subField.handleChange(event.target.value)}
                                    aria-invalid={isInvalid}
                                    placeholder="https://app.example/callback"
                                  />
                                  {field.state.value.length > 1 && (
                                    <InputGroupAddon align="inline-end">
                                      <InputGroupButton
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => field.removeValue(index)}
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => field.pushValue("")}
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
                    Register client
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

function CopyValueRow({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-1 rounded-md bg-muted p-3 font-mono text-sm">
      <span className="min-w-0 flex-1 break-all">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${label}`}
      >
        {copied ? <Check className="animate-in fade-in-0 zoom-in-75 text-primary" /> : <Copy />}
      </Button>
    </div>
  );
}
