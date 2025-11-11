import ChangePassword from "@/app/(dash)/auth/change-password";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const Page = async () => {
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });

  const hasCredential = accounts?.find((i) => i.providerId === "credential");

  return (
    <div className="max-w-3xl mx-auto">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Password</ItemTitle>
        </ItemContent>
        <ItemActions>
          {/*TODO Set Password*/}
          <ChangePassword disabled={!hasCredential} />
        </ItemActions>
      </Item>
    </div>
  );
};

export default Page;
