import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth";

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  const rawHeaders = getRequestHeaders();
  const headers = new Headers();
  if (rawHeaders) {
    for (const [key, value] of Object.entries(rawHeaders)) {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === "string") {
            headers.append(key, v);
          }
        }
      }
    }
  }
  const session = await auth.api.getSession({
    headers,
  });
  return session;
});
