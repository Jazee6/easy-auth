import { useEffect, useState } from "react";

export const useCFT = () => {
  const [token, setToken] = useState("");
  const [widgetId, setWidgetId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.onloadTurnstileCallback = () => {
      const id = turnstile.render("#cft", {
        sitekey: import.meta.env.VITE_CFT_SITE,
        callback: setToken,
      });
      setWidgetId(id);
      setIsLoading(false);
    };
  }, []);

  return { token, reset: () => turnstile.reset(widgetId), isLoading };
};

export const useCookie = (name: string) => {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(name));
    if (cookie) {
      setValue(cookie.split("=")[1]);
    }
  }, [name]);

  return value;
};
