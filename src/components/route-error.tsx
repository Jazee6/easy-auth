import { Link, useRouter } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface RouteErrorProps {
  title?: string;
  description?: string;
  /** "retry" reloads the failed route; "home" is for errors a retry cannot fix. */
  action?: "retry" | "home";
}

export function RouteError({
  title = "Something went wrong",
  description = "This page could not be loaded. Please try again.",
  action = "retry",
}: RouteErrorProps) {
  const router = useRouter();

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {action === "retry" ? (
            <Button onClick={() => void router.invalidate()}>Try again</Button>
          ) : (
            <Link data-slot="button" className={buttonVariants()} to="/">
              Back to home
            </Link>
          )}
        </EmptyContent>
      </Empty>
    </main>
  );
}
