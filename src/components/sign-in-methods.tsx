import * as React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { GithubIcon } from "@/components/github-icon";
import {
  deriveSignInMethodState,
  getGithubLinkOptions,
  translateSignInMethodsError,
  type PasskeyItem,
  type SignInMethodAccount,
} from "@/lib/auth-policy";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { toast } from "@/components/ui/toast";
import { PasskeySettings } from "@/components/passkey-settings";

interface SignInMethodsProps {
  user: {
    id: string;
    email: string;
  };
  accounts: SignInMethodAccount[];
  passkeys?: PasskeyItem[];
  status?: string;
  error?: string;
  resumePasskeyRegistration?: boolean;
}

export function SignInMethods({
  user,
  accounts,
  passkeys = [],
  status,
  error,
  resumePasskeyRegistration,
}: SignInMethodsProps) {
  const router = useRouter();
  const methodState = deriveSignInMethodState(accounts, passkeys);

  const [isLinking, setIsLinking] = React.useState(false);
  const [isUnlinking, setIsUnlinking] = React.useState(false);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === "github-linked") {
      toast.add({
        title: "GitHub linked",
        description: "GitHub is now available as a sign-in method.",
        type: "success",
      });
    } else if (error) {
      toast.add({
        title: "GitHub was not linked",
        description: translateSignInMethodsError(error),
        type: "error",
      });
    }
  }, [error, status]);

  const linkGithub = async () => {
    setIsLinking(true);

    try {
      const result = await authClient.linkSocial(getGithubLinkOptions());
      if (result.error) {
        toast.add({
          title: "GitHub was not linked",
          description: translateSignInMethodsError(result.error.code ?? "linking_failed"),
          type: "error",
        });
        setIsLinking(false);
      }
    } catch {
      toast.add({
        title: "GitHub was not linked",
        description: translateSignInMethodsError("linking_failed"),
        type: "error",
      });
      setIsLinking(false);
    }
  };

  const unlinkGithub = async () => {
    if (!methodState.github.accountId || !methodState.github.canUnlink) return;

    setIsUnlinking(true);

    try {
      const result = await authClient.unlinkAccount({
        accountId: methodState.github.accountId,
      });

      if (result.error) {
        toast.add({
          title: "GitHub was not unlinked",
          description: translateSignInMethodsError(
            (result.error as { code?: string } | null)?.code ?? "unlink_failed",
          ),
          type: "error",
        });
        return;
      }

      setIsUnlinkDialogOpen(false);
      toast.add({
        title: "GitHub unlinked",
        description: "GitHub can no longer be used to sign in to Easy Auth.",
        type: "success",
      });
      await router.invalidate();
    } catch {
      toast.add({
        title: "GitHub was not unlinked",
        description: translateSignInMethodsError("unlink_failed"),
        type: "error",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      <PageHeader
        title="Sign-in methods"
        description="Manage the ways you can sign in to Easy Auth."
      />

      <ItemGroup>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <KeyRound />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Password</ItemTitle>
            <ItemDescription>{methodState.password.isSet ? "Set" : "Not set"}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Link
              data-slot="button"
              className={buttonVariants({ variant: "outline" })}
              to="/forgot-password"
              search={{
                email: user.email,
                action: methodState.password.isSet ? "reset" : "set",
              }}
            >
              {methodState.password.isSet ? "Reset password" : "Set password"}
            </Link>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemMedia variant="icon">
            <GithubIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>GitHub</ItemTitle>
            <ItemDescription>
              {methodState.github.isLinked ? "Linked" : "Not linked"}
              {methodState.github.unlinkReason && (
                <span className="mt-1 block">{methodState.github.unlinkReason}</span>
              )}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {!methodState.github.isLinked ? (
              <Button loading={isLinking} disabled={isLinking} onClick={linkGithub}>
                Link GitHub
              </Button>
            ) : (
              <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
                <AlertDialogTrigger
                  render={<Button variant="outline" disabled={!methodState.github.canUnlink} />}
                >
                  Unlink
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlink GitHub?</AlertDialogTitle>
                    <AlertDialogDescription>
                      GitHub will stop working as a local sign-in method. This removes locally
                      stored GitHub tokens, but it does not revoke the Authorized OAuth App grant in
                      GitHub.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      loading={isUnlinking}
                      disabled={isUnlinking}
                      onClick={unlinkGithub}
                    >
                      Unlink GitHub
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </ItemActions>
        </Item>
        <PasskeySettings
          userId={user.id}
          resumeRegistration={resumePasskeyRegistration}
          passkeys={passkeys}
          canDeletePasskey={(id) => methodState.passkey?.canDelete(id) ?? true}
        />
      </ItemGroup>
    </div>
  );
}
