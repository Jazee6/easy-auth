"use client";

import { authClient, Session } from "@/lib/auth-client";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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
    if (data?.redirect) {
      location.href = data.uri;
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
          {/** biome-ignore lint/performance/noImgElement: <any host> */}
          <img src={user.image} alt="avatar" className="object-cover size-8" />
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
