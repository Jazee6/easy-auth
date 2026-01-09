import { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkSession, getOAuthApp } from "@/lib/actions";
import { redirect } from "next/navigation";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import Client from "@/app/consent/client";

export const metadata: Metadata = {
  title: "Consent - Easy Auth",
  description: "Easy Auth consent page for authorizing other applications.",
};

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ client_id: string; scope: string }>;
}) => {
  const { client_id, scope } = await searchParams;
  const session = await checkSession();
  const app = await getOAuthApp(client_id);

  if (!app) {
    redirect("/profile");
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Login to {app.name}</CardTitle>
            <CardDescription>
              {app.name} is requesting the following permissions:
              <ul className="flex gap-1 mt-2">
                {scope.split(" ").map((s) => (
                  <li key={s}>
                    <Badge variant="secondary">{s}</Badge>
                  </li>
                ))}
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Client session={session} />
          </CardContent>
        </Card>

        <Footer classname="mt-6" />
      </div>
    </main>
  );
};

export default Page;
