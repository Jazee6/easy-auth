import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const Index = async ({ children }: LayoutProps<"/">) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isAdmin = session?.user.role === "admin";
  if (!isAdmin) {
    redirect("/");
  }

  return children;
};

export default Index;
