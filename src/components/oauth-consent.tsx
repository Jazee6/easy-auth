import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scopeDescriptions, supportedScopes } from "@/lib/oauth-policy";
import { authClient } from "@/lib/auth-client";

export function OAuthConsent({
  client,
  scopes,
}: {
  client: { clientId: string; name: string };
  scopes: string[];
}) {
  const [pending, setPending] = useState<"accept" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (accept: boolean) => {
    setPending(accept ? "accept" : "deny");
    setError(null);
    try {
      const result = await authClient.oauth2.consent({ accept });
      if (result.error) {
        setError(result.error.message ?? "Unable to complete authorization.");
        setPending(null);
        return;
      }
      if (result.data && "url" in result.data && typeof result.data.url === "string") {
        window.location.assign(result.data.url);
      }
    } catch {
      setError("Unable to complete authorization. Return to the application and try again.");
      setPending(null);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Authorize {client.name}?</CardTitle>
          <CardDescription className="break-all">Client ID: {client.clientId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div>
            <p className="mb-3 text-sm font-medium">This application is requesting:</p>
            <ul className="space-y-3">
              {scopes.map((scope) => (
                <li key={scope} className="rounded-md border p-3">
                  <p className="font-mono text-sm font-medium">{scope}</p>
                  <p className="text-sm text-muted-foreground">
                    {supportedScopes.includes(scope as (typeof supportedScopes)[number])
                      ? scopeDescriptions[scope as (typeof supportedScopes)[number]]
                      : "Access requested by this application."}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Approval applies to the complete scope set. You can revoke it later from Authorized
            applications.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              loading={pending === "deny"}
              disabled={pending !== null}
              onClick={() => decide(false)}
            >
              Deny
            </Button>
            <Button
              loading={pending === "accept"}
              disabled={pending !== null}
              onClick={() => decide(true)}
            >
              Allow
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
