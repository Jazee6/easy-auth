"use client";

import { z } from "zod";
import { useId, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { addApp } from "@/lib/actions";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { XIcon } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import CopyButton from "@/components/copy-button";

const appAddSchema = z.object({
  client_name: z.string().min(1).trim(),
  redirect_uris: z
    .array(
      z.object({
        value: z.url().trim(),
      }),
    )
    .min(1, "At least one Redirect URI is required."),
});

const AddDrawer = ({
  open,
  onOpenChange,
  refetch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refetch: () => void;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{
    client_id: string;
    client_secret?: string;
  }>();
  const formId = useId();
  const nameId = useId();

  const form = useForm<z.infer<typeof appAddSchema>>({
    resolver: zodResolver(appAddSchema),
    defaultValues: {
      client_name: "",
      redirect_uris: [{ value: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "redirect_uris",
  });

  const onSubmit = async (data: z.infer<typeof appAddSchema>) => {
    setIsPending(true);
    const { redirect_uris, ...rest } = data;
    const { client_id, client_secret } = await addApp({
      redirect_uris: redirect_uris.map(({ value }) => value),
      ...rest,
    }).finally(() => setIsPending(false));
    setResult({ client_id, client_secret });
    toast.success("App created successfully.");
  };

  const onDrawerOpenChange = (open: boolean) => {
    if (result) {
      refetch();
      setResult(undefined);
    }

    onOpenChange(open);
  };

  return (
    <Drawer open={open} onOpenChange={onDrawerOpenChange} direction="right">
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add App</DrawerTitle>
            <DrawerDescription></DrawerDescription>
          </DrawerHeader>

          {result ? (
            <FieldSet className="px-4 overflow-auto">
              <FieldGroup>
                <Field>
                  <FieldLabel>Client ID</FieldLabel>
                  <div className="flex items-center gap-2">
                    <code>{result.client_id}</code>
                    <CopyButton content={result.client_id} />
                  </div>
                </Field>

                <Field>
                  <FieldLabel>Client Secret</FieldLabel>
                  <div className="flex items-center gap-2">
                    <code>{result.client_secret}</code>
                    <CopyButton content={result.client_secret ?? ""} />
                  </div>
                  <FieldDescription>
                    The client secret will not be shown again.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>
          ) : (
            <FieldSet className="px-4 overflow-auto">
              <FieldGroup>
                <Controller
                  name="client_name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={nameId}>Name</FieldLabel>
                      <Input
                        {...field}
                        id={nameId}
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <FieldSet className="gap-4">
                  <FieldLegend variant="label">Redirect URIs</FieldLegend>
                  <FieldDescription>
                    Add at least one valid redirect URI for your application.
                  </FieldDescription>
                  <FieldGroup className="gap-4">
                    {fields.map((field, index) => (
                      <Controller
                        key={field.id}
                        name={`redirect_uris.${index}.value`}
                        control={form.control}
                        render={({ field: controllerField, fieldState }) => (
                          <Field
                            orientation="horizontal"
                            data-invalid={fieldState.invalid}
                          >
                            <FieldContent>
                              <InputGroup>
                                <InputGroupInput
                                  {...controllerField}
                                  aria-invalid={fieldState.invalid}
                                  inputMode="url"
                                />
                                {fields.length > 1 && (
                                  <InputGroupAddon align="inline-end">
                                    <InputGroupButton
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => remove(index)}
                                      aria-label={`Remove redirect uri ${index + 1}`}
                                    >
                                      <XIcon />
                                    </InputGroupButton>
                                  </InputGroupAddon>
                                )}
                              </InputGroup>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </FieldContent>
                          </Field>
                        )}
                      />
                    ))}
                  </FieldGroup>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ value: "" })}
                  >
                    Add Redirect URI
                  </Button>
                </FieldSet>
              </FieldGroup>
            </FieldSet>
          )}

          <DrawerFooter>
            {result ? (
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            ) : (
              <>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
                <Button type="submit" form={formId} disabled={isPending}>
                  {isPending && <Spinner />}
                  Save
                </Button>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </form>
    </Drawer>
  );
};

export default AddDrawer;
