import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { ProgressProvider, useProgress } from "@bprogress/react";

function RouterProgressListener() {
  const router = useRouter();
  const { start, stop } = useProgress();

  React.useEffect(() => {
    const unsubBeforeLoad = router.subscribe("onBeforeLoad", (event) => {
      if (event.pathChanged) {
        start();
      }
    });
    const unsubRendered = router.subscribe("onRendered", () => {
      stop();
    });

    return () => {
      unsubBeforeLoad();
      unsubRendered();
    };
  }, [router, start, stop]);

  return null;
}

export function RouteProgress() {
  return (
    <ProgressProvider color="var(--primary)" height="4px" options={{ showSpinner: false }}>
      <RouterProgressListener />
    </ProgressProvider>
  );
}
