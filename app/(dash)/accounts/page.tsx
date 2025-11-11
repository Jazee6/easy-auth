import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Client from "@/app/(dash)/accounts/client";

const Page = async () => {
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <Client accounts={accounts} />
    </div>
  );
};

export default Page;
