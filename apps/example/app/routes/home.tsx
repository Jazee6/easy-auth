import type { Route } from "./+types/home";
import { Button } from "@/components/ui/button";
import { EasyAuthWeb } from "@easy-auth/sdk";
import { id_tk } from "@/routes/auth";
import { easyAuthClient } from "@/lib/utils";
import { Form } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Easy Auth Example App" },
    { name: "description", content: "Easy Auth Example App" },
  ];
}

const easyAuth = new EasyAuthWeb({
  appId: "YepnfmohEW2hrYP3x5LH5",
  host: "http://localhost:5173",
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
          <Form method="POST" className="mt-2">
            <Button type="submit">Logout</Button>
          </Form>
        </>
      ) : (
        <Button onClick={easyAuth.openLoginWindow}>Login</Button>
      )}
    </main>
  );
}
