import { useEffect, useState } from "react";
import useSWR from "swr";
import { User } from "@/lib/types.ts";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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

export const useUserProfile = (permission?: string) => {
  const user = useSWR<User>("/profile");
  const nav = useNavigate();

  useEffect(() => {
    if (user.data && permission) {
      if (user.data.scope !== permission) {
        toast.error("没有权限");
        nav("/login");
      }
    }
  }, [nav, permission, user.data]);

  return user;
};
