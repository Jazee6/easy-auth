import type { Route } from "../../.react-router/types/app/routes/+types/home";
import { easyAuthClient } from "@/lib/utils";
import { createCookie, redirect } from "react-router";
import * as process from "node:process";

export const id_tk = createCookie("id_token", {
  maxAge: 60 * 60 * 24,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
});

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const { id_token } = await easyAuthClient.onLoginRedirect(code!);
  return redirect("/", {
    headers: {
      "Set-Cookie": await id_tk.serialize(id_token),
    },
  });
};
