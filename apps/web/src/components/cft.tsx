import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useCFT } from "@/lib/hooks";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";

export const useCftForm = (form: UseFormReturn<any>) => {
  const { setValue } = form;

  const { token, reset, isLoading } = useCFT();

  useEffect(() => {
    setValue("cft", token);
  }, [setValue, token]);

  useEffect(() => {
    window.expiredCallback = () => {
      setValue("cft", "");
    };
  }, [setValue]);

  const resetCft = () => {
    setValue("cft", "");
    reset();
  };

  return {
    holder: (
      <>
        <script
          async
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback"
        />
        <FormField
          name="cft"
          render={() => (
            <FormItem>
              <div
                id="cft"
                data-size="flexible"
                data-expired-callback="expiredCallback"
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </>
    ),
    reset: resetCft,
    isLoading,
  };
};
