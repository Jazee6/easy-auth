import { describe, expect, test } from "bun:test";
import { FieldApi, FormApi } from "@tanstack/react-form";
import * as v from "valibot";

const schema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email address")),
});

describe("submit-only form validation", () => {
  test("does not validate on value changes and clears submit errors on change", async () => {
    const form = new FormApi({
      defaultValues: { email: "" },
      validators: { onSubmit: schema },
    });
    const cleanup = form.mount();
    const field = new FieldApi({ form, name: "email" });
    const cleanupField = field.mount();

    field.handleChange("not-an-email");
    expect(form.state.errorMap.onChange).toBeUndefined();
    expect(form.state.fieldMeta.email?.errors.length).toBe(0);

    await form.handleSubmit();
    expect(form.state.fieldMeta.email?.errorMap.onSubmit).toBeDefined();

    field.handleChange("person@example.com");
    expect(form.state.fieldMeta.email?.errorMap.onSubmit).toBeUndefined();
    cleanupField();
    cleanup();
  });
});
