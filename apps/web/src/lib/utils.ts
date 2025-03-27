import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getGithubUrl = ({
  appId,
  redirect,
}: {
  appId?: string;
  redirect?: string;
}) => {
  const state = Math.random().toString(36).slice(2);

  sessionStorage.setItem("state", state);

  const redirect_uri = new URL(
    `/auth/github/${appId || "easy-auth"}`,
    window.location.origin,
  );
  redirect_uri.searchParams.set("redirect", redirect || "/");

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", import.meta.env.VITE_GITHUB_ID);
  url.searchParams.set("redirect_uri", redirect_uri.toString());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "user:email");

  return url.href;
};
