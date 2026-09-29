import * as React from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const ResponsiveDialogContext = React.createContext(false);

function useIsDrawer() {
  return React.useContext(ResponsiveDialogContext);
}

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  children?: React.ReactNode;
}

/** A Dialog on desktop that becomes a bottom Drawer on mobile viewports. */
function ResponsiveDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  children,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <ResponsiveDialogContext.Provider value={isMobile}>
      <Root
        open={open}
        onOpenChange={onOpenChange && ((nextOpen) => onOpenChange(nextOpen))}
        onOpenChangeComplete={onOpenChangeComplete}
      >
        {children}
      </Root>
    </ResponsiveDialogContext.Provider>
  );
}

function ResponsiveDialogTrigger(
  props: Omit<React.ComponentProps<typeof DialogTrigger>, "handle">,
) {
  return useIsDrawer() ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  return useIsDrawer() ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

function ResponsiveDialogContent({
  className,
  showCloseButton,
  children,
}: {
  className?: string;
  showCloseButton?: boolean;
  children?: React.ReactNode;
}) {
  if (useIsDrawer()) {
    return (
      <DrawerContent>
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-4">{children}</div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent
      className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto", className)}
      showCloseButton={showCloseButton}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return useIsDrawer() ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return useIsDrawer() ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}

/** Backdrop for a Dialog nested in another Dialog; nested Drawers stack instead. */
function ResponsiveDialogNestedOverlay() {
  if (useIsDrawer()) return null;
  return (
    <DialogPortal>
      <DialogOverlay forceRender />
    </DialogPortal>
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  DialogFooter as ResponsiveDialogFooter,
  DialogHeader as ResponsiveDialogHeader,
  ResponsiveDialogNestedOverlay,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
