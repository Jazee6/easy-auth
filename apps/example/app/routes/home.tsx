import { Button } from "@/components/ui/button";
import { easyAuthClient } from "@/lib/utils";
import { id_tk } from "@/routes/auth";
import { EasyAuthWeb } from "@easy-auth/sdk";
import { Form, Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Easy Auth Example App" },
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
  if (!id_token) {
    return;
  }
  let payload;
  try {
    payload = await easyAuthClient.verifyES256JWT(id_token);
  } catch (error) {
    return;
  }
  return { id: payload.sub };
};

export const action = async ({}: Route.ActionArgs) => {
  return new Response(null, {
    headers: {
      "Set-Cookie": await id_tk.serialize(null, {
        maxAge: -1,
      }),
    },
  });
};

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="h-screen flex flex-col items-center justify-center">
      {loaderData?.id ? (
        <>
          Login Success! Your ID:
          <div className="font-mono mt-2">{loaderData.id}</div>
          <div className="space-x-2 flex mt-4">
            <Form method="POST">
              <Button type="submit">Logout</Button>
            </Form>
            <Link to="/info">
              <Button variant="secondary">Info</Button>
            </Link>
          </div>
        </>
      ) : (
        <Button onClick={() => easyAuth.openLoginWindow()}>Login</Button>
      )}
    </main>
  );
}
