import { z } from "zod";
import { useEffect, useId, useState } from "react";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { XIcon } from "lucide-react";
import CopyButton from "@/components/copy-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableItem } from "@/routes/_dash/apps.tsx";
import { useServerFn } from "@tanstack/react-start";
import { addApp, updateApp } from "@/lib/actions.ts";

const appAddSchema = z.object({
  id: z.string(),
  client_name: z.string().min(1).trim(),
  redirect_uris: z
    .array(
      z.object({
        value: z.url().trim(),
      }),
    )
    .min(1, "At least one Redirect URI is required."),
});

const AppDrawer = ({
  open,
  onOpenChange,
  refetch,
  rowData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refetch: () => void;
  rowData?: TableItem;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{
    client_id: string;
    client_secret?: string;
  }>();
  const formId = useId();
  const nameId = useId();
  const updateAppServer = useServerFn(updateApp);
  const addAppServer = useServerFn(addApp);

  const isEdit = !!rowData;

  const form = useForm<z.infer<typeof appAddSchema>>({
    resolver: zodResolver(appAddSchema),
    defaultValues: {
      id: "",
      client_name: "",
      redirect_uris: [{ value: "" }],
    },
  });

  useEffect(() => {
    if (isEdit && rowData) {
      form.reset({
        id: rowData.id,
        client_name: rowData.name ?? "",
        redirect_uris: rowData.redirectUris.map((url) => ({ value: url })),
      });
    }
  }, [form.reset, rowData, isEdit]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "redirect_uris",
  });

  const onSubmit = async (data: z.infer<typeof appAddSchema>) => {
    setIsPending(true);
    const { id, client_name, redirect_uris } = data;

    if (isEdit) {
      await updateAppServer({
        data: {
          id,
          params: {
            name: client_name,
            redirectUris: redirect_uris.map(({ value }) => value),
          },
        },
      }).finally(() => setIsPending(false));
      toast.success("App updated successfully.");
      refetch();
      onOpenChange(false);
      return;
    }

    const { client_id, client_secret } = await addAppServer({
      data: {
        client_name,
        redirect_uris: redirect_uris.map(({ value }) => value),
      },
    }).finally(() => setIsPending(false));
    setResult({ client_id, client_secret });
  };

  const onDrawerOpenChange = (open: boolean) => {
    if (result) {
      refetch();
      setResult(undefined);
    }

    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={onDrawerOpenChange}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add App</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>

          {result ? (
            <FieldSet>
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
            <FieldSet>
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

          <DialogFooter>
            {result ? (
              <DialogClose render={<Button variant="outline">Close</Button>} />
            ) : (
              <>
                <DialogClose
                  render={<Button variant="outline">Cancel</Button>}
                />
                <Button type="submit" form={formId} disabled={isPending}>
                  {isPending && <Spinner />}
                  Save
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
};

export default AppDrawer;
