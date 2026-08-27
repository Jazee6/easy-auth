import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";

import { authClient } from "@/lib/auth-client";
import { getInitials, profileSchema, translateProfileError } from "@/lib/auth-policy";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";

export function ProfileForm({
  user,
}: {
  user: {
    name: string;
    image?: string | null;
  };
}) {
  const router = useRouter();
  const [previewImage, setPreviewImage] = useState(user.image ?? "");

  const form = useForm({
    defaultValues: {
      name: user.name,
      image: user.image ?? "",
    },
    onSubmit: async ({ value }) => {
      const validation = v.safeParse(profileSchema, value);
      if (!validation.success) {
        return;
      }

      const trimmedImage = value.image?.trim() || null;

      try {
        const res = await authClient.updateUser({
          name: value.name.trim(),
          image: trimmedImage,
        });

        if (res.error) {
          toast.add({
            title: "Update failed",
            description: translateProfileError(res.error),
            type: "error",
          });
          return;
        }

        toast.add({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
          type: "success",
        });

        await router.invalidate();
      } catch (err) {
        toast.add({
          title: "Update failed",
          description: translateProfileError(err),
          type: "error",
        });
      }
    },
  });

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-start py-2">
            <Avatar className="h-16 w-16">
              <AvatarImage src={previewImage || undefined} alt={user.name} />
              <AvatarFallback className="text-lg">
                {getInitials(form.getFieldValue("name") || user.name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                const res = v.safeParse(profileSchema.entries.name, value);
                return res.success ? undefined : res.issues[0].message;
              },
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel htmlFor="name">Nick Name</FieldLabel>
                <Input
                  id="name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                )}
              </Field>
            )}
          </form.Field>

          <form.Field
            name="image"
            validators={{
              onChange: ({ value }) => {
                const res = v.safeParse(profileSchema.entries.image, value);
                return res.success ? undefined : res.issues[0].message;
              },
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel htmlFor="image">Avatar URL (Optional)</FieldLabel>
                <Input
                  id="image"
                  name={field.name}
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                    setPreviewImage(field.state.value);
                  }}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setPreviewImage(e.target.value);
                  }}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors[0]?.toString()}</FieldError>
                )}
              </Field>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="pt-2">
                <Button type="submit" loading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </div>
  );
}
