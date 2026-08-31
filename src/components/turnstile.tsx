import * as React from "react";

import { cn } from "@/lib/utils";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";

interface TurnstileApi {
  render: (
    container: HTMLElement | string,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: (errorCode?: string) => void;
      "timeout-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | undefined;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (window.turnstile) {
        resolve();
      } else {
        scriptPromise = undefined;
        reject(new Error("Cloudflare Turnstile did not initialize"));
      }
    };
    const handleError = () => {
      scriptPromise = undefined;
      reject(new Error("Cloudflare Turnstile script failed to load"));
    };

    if (!script) {
      script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
      return;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
  });

  return scriptPromise;
}

export interface TurnstileRef {
  reset: () => void;
}

export interface TurnstileProps {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: (error?: unknown) => void;
  siteKey?: string;
  action?: string;
  className?: string;
}

const defaultSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const Turnstile = React.forwardRef<TurnstileRef, TurnstileProps>(function Turnstile(
  { onSuccess, onExpire, onError, siteKey = defaultSiteKey, action, className },
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const callbacksRef = React.useRef({ onSuccess, onExpire, onError });
  callbacksRef.current = { onSuccess, onExpire, onError };

  const resetWidget = React.useCallback(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  React.useImperativeHandle(ref, () => ({ reset: resetWidget }), [resetWidget]);

  React.useEffect(() => {
    let active = true;

    if (!siteKey) {
      callbacksRef.current.onError?.(new Error("TURNSTILE_SITE_KEY is not configured"));
      return;
    }

    void loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          size: "flexible",
          callback: (token) => callbacksRef.current.onSuccess(token),
          "expired-callback": () => {
            callbacksRef.current.onExpire?.();
            resetWidget();
          },
          "error-callback": (errorCode) => {
            callbacksRef.current.onError?.(errorCode);
            resetWidget();
          },
          "timeout-callback": () => {
            callbacksRef.current.onError?.(new Error("Cloudflare Turnstile timed out"));
            resetWidget();
          },
        });
      })
      .catch((error) => {
        if (active) {
          callbacksRef.current.onError?.(error);
        }
      });

    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, resetWidget, siteKey]);

  return (
    <div className={cn("w-full", className)}>
      <div data-slot="turnstile-container" ref={containerRef} className="w-full min-h-[65px]" />
    </div>
  );
});
