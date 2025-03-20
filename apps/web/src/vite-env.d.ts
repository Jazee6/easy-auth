/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CFT_SITE: string;
  readonly VITE_API_URL: string;
  readonly VITE_GITHUB_ID: string;
}

declare const turnstile: {
  ready: (cb: () => void) => void;
  render: (
    selector: string,
    options: { sitekey: string; callback: (token: string) => void },
  ) => string;
  reset: (id: string) => void;
};

declare interface Window {
  onloadTurnstileCallback: () => void;
  expiredCallback: () => void;
}
