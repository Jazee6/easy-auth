import { Button } from "@/components/ui/button";
import { easyAuthClient } from "@/lib/utils";
import { id_tk } from "@/routes/auth";
import { EasyAuthWeb } from "@easy-auth/sdk";
import type { Route } from "./+types/info";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Info" },
    { name: "description", content: "Easy Auth Example App" },
  ];
}

const easyAuth = new EasyAuthWeb({
  appId: "c576ebdc1ccc4560b29639d34e1dafbf",
  host: "http://localhost:5173",
  redirect_uri: "http://i.localhost:5174/auth",
});

export const loader = async ({ request }: Route.LoaderArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const id_token = await id_tk.parse(cookieHeader);
  return easyAuthClient.getUserInfo(id_token).catch((err) => {});
};

export default function Info({ loaderData }: Route.ComponentProps) {
  return (
    <main className="h-screen flex flex-col items-center justify-center">
      {loaderData ? (
        <ul className="list-disc">
          <li>email: {loaderData.email}</li>
          <li>nickname: {loaderData.nickname}</li>
          <li>createdAt: {new Date(loaderData.createdAt).toDateString()}</li>
          <li>
            <img
              className="size-16 rounded-full"
              src={loaderData.avatar}
              alt="avatar"
            />
          </li>
        </ul>
      ) : (
        <Button onClick={() => easyAuth.openLoginWindow("?redirect=/info")}>
          Login
        </Button>
      )}
    </main>
  );
}
