import * as React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import {
  deriveSignInMethodState,
  externalIdentityProviders,
  getExternalIdentityLinkOptions,
  getExternalIdentityProviderName,
  translateSignInMethodsError,
  type ExternalIdentityMethodState,
  type ExternalIdentityProvider,
  type PasskeyItem,
  type SignInMethodAccount,
} from "@/lib/auth-policy";
import { GithubIcon } from "@/components/github-icon";
import { GoogleIcon } from "@/components/google-icon";
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
  errorProvider?: ExternalIdentityProvider;
  resumePasskeyRegistration?: boolean;
}

const providerIcons: Record<
  ExternalIdentityProvider,
  (props: React.ComponentProps<"svg">) => React.ReactNode
> = {
  google: GoogleIcon,
  github: GithubIcon,
};

function ExternalIdentityItem({
  provider,
  state,
}: {
  provider: ExternalIdentityProvider;
  state: ExternalIdentityMethodState;
}) {
  const router = useRouter();
  const providerName = getExternalIdentityProviderName(provider);
  const ProviderIcon = providerIcons[provider];
  const [isLinking, setIsLinking] = React.useState(false);
  const [isUnlinking, setIsUnlinking] = React.useState(false);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = React.useState(false);

  const linkExternalIdentity = async () => {
    setIsLinking(true);

    try {
      const result = await authClient.linkSocial(getExternalIdentityLinkOptions(provider));
      if (result.error) {
        toast.add({
          title: `${providerName} was not linked`,
          description: translateSignInMethodsError(provider, result.error.code ?? "linking_failed"),
          type: "error",
        });
        setIsLinking(false);
      }
    } catch {
      toast.add({
        title: `${providerName} was not linked`,
        description: translateSignInMethodsError(provider, "linking_failed"),
        type: "error",
      });
      setIsLinking(false);
    }
  };

  const unlinkExternalIdentity = async () => {
    if (!state.accountId || !state.canUnlink) return;

    setIsUnlinking(true);

    try {
      const result = await authClient.unlinkAccount({ accountId: state.accountId });
      if (result.error) {
        toast.add({
          title: `${providerName} was not unlinked`,
          description: translateSignInMethodsError(
            provider,
            (result.error as { code?: string } | null)?.code ?? "unlink_failed",
          ),
          type: "error",
        });
        return;
      }

      setIsUnlinkDialogOpen(false);
      toast.add({
        title: `${providerName} unlinked`,
        description: `${providerName} can no longer be used to sign in to Easy Auth.`,
        type: "success",
      });
      await router.invalidate();
    } catch {
      toast.add({
        title: `${providerName} was not unlinked`,
        description: translateSignInMethodsError(provider, "unlink_failed"),
        type: "error",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <ProviderIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{providerName}</ItemTitle>
        <ItemDescription>
          {state.isLinked ? "Linked" : "Not linked"}
          {state.unlinkReason && <span className="mt-1 block">{state.unlinkReason}</span>}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {!state.isLinked ? (
          <Button loading={isLinking} disabled={isLinking} onClick={linkExternalIdentity}>
            Link {providerName}
          </Button>
        ) : (
          <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
            <AlertDialogTrigger render={<Button variant="outline" disabled={!state.canUnlink} />}>
              Unlink
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unlink {providerName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {providerName} will stop working as a sign-in method. This removes locally stored
                  {` ${providerName} tokens`}, but it does not revoke access at {providerName}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  loading={isUnlinking}
                  disabled={isUnlinking}
                  onClick={unlinkExternalIdentity}
                >
                  Unlink {providerName}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </ItemActions>
    </Item>
  );
}

export function SignInMethods({
  user,
  accounts,
  passkeys = [],
  status,
  error,
  errorProvider,
  resumePasskeyRegistration,
}: SignInMethodsProps) {
  const methodState = deriveSignInMethodState(accounts, passkeys);

  React.useEffect(() => {
    const linkedProvider = externalIdentityProviders.find(
      (provider) => status === `${provider}-linked`,
    );
    if (linkedProvider) {
      const providerName = getExternalIdentityProviderName(linkedProvider);
      toast.add({
        title: `${providerName} linked`,
        description: `${providerName} is now available as a sign-in method.`,
        type: "success",
      });
    } else if (error) {
      toast.add({
        title: errorProvider
          ? `${getExternalIdentityProviderName(errorProvider)} was not linked`
          : "External identity was not linked",
        description: translateSignInMethodsError(errorProvider, error),
        type: "error",
      });
    }
  }, [error, errorProvider, status]);

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

        <ExternalIdentityItem provider="google" state={methodState.google} />
        <ExternalIdentityItem provider="github" state={methodState.github} />
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
