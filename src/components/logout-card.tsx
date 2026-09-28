import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleAlertIcon, InfoIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LOGOUT_CONFIRM_ACTION, type LogoutSearch } from "@/lib/logout-presentation";

export function LogoutCard({ step, unregistered }: LogoutSearch) {
  if (step === "confirm") return <LogoutConfirmation />;
  if (step === "signed-out") return <SignedOut unregistered={Boolean(unregistered)} />;
  return <LogoutError />;
}

function LogoutConfirmation() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign out of Easy Auth?</CardTitle>
        <CardDescription>
          An application asked to end your Easy Auth session in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* A native form lets the browser follow the provider's redirect back to the application. */}
        <form
          method="post"
          action={LOGOUT_CONFIRM_ACTION}
          onSubmit={() => setSubmitting(true)}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="action" value="confirm" />
          <Button type="submit" className="w-full" loading={submitting}>
            Sign out
          </Button>
          <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Stay signed in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}

function SignedOut({ unregistered }: { unregistered: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>You're signed out</CardTitle>
        <CardDescription>Your Easy Auth session in this browser has ended.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {unregistered && (
          <Alert>
            <InfoIcon />
            <AlertDescription>
              The application's return address isn't registered, so you stayed here.
            </AlertDescription>
          </Alert>
        )}
        <Link to="/login" className={cn(buttonVariants(), "w-full")}>
          Sign in
        </Link>
      </CardContent>
    </Card>
  );
}

function LogoutError() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Couldn't sign you out</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>This sign-out request can't be completed</AlertTitle>
          <AlertDescription>
            It may be invalid or expired. Return to the application and try signing out again.
          </AlertDescription>
        </Alert>
        <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Back to Easy Auth
        </Link>
      </CardContent>
    </Card>
  );
}
