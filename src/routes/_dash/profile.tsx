import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client.ts";
import { toast } from "sonner";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { appName } from "@/lib/constants.ts";

export const Route = createFileRoute("/_dash/profile")({
  component: Page,
  staticData: {
    title: "Profile",
  },
  head: () => ({
    meta: [
      {
        title: `Profile - ${appName}`,
      },
      {
        name: "description",
        content: `Update your profile information on ${appName}.`,
      },
    ],
  }),
});

const profileUpdateSchema = z.object({
  image: z.url().or(z.string().length(0)),
  name: z.string().min(1).trim(),
});

function Page() {
  const { session } = Route.useRouteContext();
  const { user } = session;
  const router = useRouter();
  const imageId = useId();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof profileUpdateSchema>>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      image: user.image ?? "",
      name: user.name,
    },
  });

  const onSubmit = async (data: z.infer<typeof profileUpdateSchema>) => {
    setIsLoading(true);
    await authClient.updateUser(data).finally(() => setIsLoading(false));
    await router.invalidate();
    toast.success("Profile updated successfully.");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldLegend>Profile</FieldLegend>
          <FieldDescription>
            You can update your profile information here.
          </FieldDescription>

          <FieldGroup>
            <Field orientation="horizontal">
              <Avatar className="rounded-full size-24">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback>
                  {user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Field>

            <Controller
              name="image"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={imageId}>Avatar Link</FieldLabel>
                  <Input
                    {...field}
                    id={imageId}
                    aria-invalid={fieldState.invalid}
                    placeholder="https://example.com/avatar.avif"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={imageId}>Name</FieldLabel>
                  <Input
                    {...field}
                    id={imageId}
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Field orientation="horizontal">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner />}
                Update
              </Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    </div>
  );
}
