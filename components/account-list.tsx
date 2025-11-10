"use client";

import { auth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import Image from "next/image";
import GithubMark from "@/assets/github-mark.svg";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const AccountList = ({
  accounts,
}: {
  accounts: Awaited<ReturnType<typeof auth.api.listUserAccounts>>;
}) => {
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  const onUnlink = async () => {
    setUnlinkLoading(true);
    await authClient
      .unlinkAccount({
        providerId: "github",
      })
      .finally(() => setUnlinkLoading(false));
  };

  const onLink = async () => {
    await authClient.linkSocial({
      provider: "github",
      callbackURL: "/accounts",
    });
  };

  const github = accounts?.find((i) => i.providerId === "github");

  return (
    <Item variant="outline">
      {/*TODO Email change / delete user / verify*/}
      <ItemMedia variant="image">
        <Image src={GithubMark} alt="github logo" width={32} height={32} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Github</ItemTitle>
        {github?.updatedAt ? (
          <ItemDescription suppressHydrationWarning>
            {new Date(github.updatedAt).toLocaleString()}
          </ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        {github ? (
          <Button
            variant="secondary"
            onClick={onUnlink}
            disabled={unlinkLoading}
          >
            {unlinkLoading && <Spinner />}
            Unlink
          </Button>
        ) : (
          <Button onClick={onLink}>Link</Button>
        )}
      </ItemActions>
    </Item>
  );
};

export default AccountList;
