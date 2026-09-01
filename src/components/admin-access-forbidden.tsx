import { Link } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function AdminAccessForbidden() {
  return (
    <Empty className="min-h-[50vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldX />
        </EmptyMedia>
        <EmptyTitle>Administrator access required</EmptyTitle>
        <EmptyDescription>
          This area is limited to Administrators of the Identity Domain.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/profile" className={buttonVariants({ variant: "outline" })}>
          Back to account
        </Link>
      </EmptyContent>
    </Empty>
  );
}
