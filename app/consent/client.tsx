"use client";

import { authClient, Session } from "@/lib/auth-client";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const Client = ({ session }: { session: Session }) => {
  const [isLoading, setIsLoading] = useState(false);

  const { user } = session;

  const onApprove = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const { data } = await authClient.oauth2
      .consent({
        accept: true,
      })
      .finally(() => setIsLoading(false));
    if (data) {
      location.href = data.redirectURI;
    }
  };

  return (
    <Item
      variant="outline"
      role="listitem"
      className={cn(
        "hover:bg-secondary",
        isLoading ? "cursor-default" : "cursor-pointer",
      )}
      onClick={onApprove}
    >
      {user.image && (
        <ItemMedia variant="image">
          <Image
            src={user.image}
            alt="avatar"
            width={32}
            height={32}
            className="object-cover"
          />
        </ItemMedia>
      )}
      <ItemContent>
        <ItemTitle className="line-clamp-1">{user.name}</ItemTitle>
        <ItemDescription>{user.email}</ItemDescription>
      </ItemContent>

      <ItemContent className="flex-none text-center">
        <ItemDescription>
          {isLoading ? <Spinner /> : <ChevronRight />}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
};

export default Client;
