"use client";

import { z } from "zod";
import { useEffect, useId, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateApp } from "@/lib/actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TableItem } from "@/app/(dash)/(admin)/apps/page";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { XIcon } from "lucide-react";

const appUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).trim(),
  redirect_uris: z
    .array(
      z.object({
        value: z.url().trim(),
      }),
    )
    .min(1, "At least one Redirect URI is required."),
});

const EditDialog = ({
  open,
  onOpenChange,
  rowData,
  refetch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowData?: TableItem;
  refetch: () => void;
}) => {
  const [isPending, setIsPending] = useState(false);
  const formId = useId();
  const nameId = useId();

  const form = useForm<z.infer<typeof appUpdateSchema>>({
    resolver: zodResolver(appUpdateSchema),
  });

  useEffect(() => {
    if (rowData) {
      form.reset({
        id: rowData.id,
        name: rowData.name ?? "",
        redirect_uris: rowData.redirectURLs
          ?.split(",")
          .map((url) => ({ value: url })),
      });
    }
  }, [form.reset, rowData]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "redirect_uris",
  });

  const onSubmit = async (data: z.infer<typeof appUpdateSchema>) => {
    setIsPending(true);
    const { id, ...rest } = data;
    await updateApp(id, {
      ...rest,
      redirectURLs: rest.redirect_uris.map(({ value }) => value).join(","),
    }).finally(() => setIsPending(false));
    refetch();
    onOpenChange(false);
    toast.success("App updated successfully.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit App</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>

          <FieldSet>
            <FieldGroup>
              <Controller
                name="name"
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
            </FieldGroup>
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
          </FieldSet>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" form={formId} disabled={isPending}>
              {isPending && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
};

export default EditDialog;
