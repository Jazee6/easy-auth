import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getGithubUrl = ({
  client_id,
  state,
  redirect_uri,
  redirect,
}: {
  client_id?: string;
  state?: string;
  redirect_uri?: string;
  redirect?: string;
}) => {
  const o_state = Math.random().toString(36).slice(2);

  sessionStorage.setItem("state", o_state);

  const o_redirect_uri = new URL("/auth/github", location.origin);
  if (client_id) {
    o_redirect_uri.searchParams.set("client_id", client_id);
  }
  if (state) {
    o_redirect_uri.searchParams.set("state", state);
  }
  if (redirect_uri) {
    o_redirect_uri.searchParams.set("redirect_uri", redirect_uri);
  }
  o_redirect_uri.searchParams.set("redirect", redirect || "/");

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", import.meta.env.VITE_GITHUB_ID);
  url.searchParams.set("redirect_uri", o_redirect_uri.toString());
  url.searchParams.set("state", o_state);
  url.searchParams.set("scope", "user:email");

  return url.href;
};
