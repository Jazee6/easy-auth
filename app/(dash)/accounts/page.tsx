import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import AccountList from "@/components/account-list";

const Page = async () => {
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <AccountList accounts={accounts} />
    </div>
  );
};

export default Page;
