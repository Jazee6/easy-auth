import { checkSession } from "@/lib/actions";
import { redirect } from "next/navigation";

const Page = async () => {
  const { user } = await checkSession();

  if (user) {
    redirect("/profile");
  }
};

export default Page;
