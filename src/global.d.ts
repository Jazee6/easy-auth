/// <reference types="vite/client" />

import { RowData } from "@tanstack/table-core";

declare global {
  declare namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string;
      readonly GITHUB_CLIENT_ID: string;
      readonly GITHUB_CLIENT_SECRET: string;
      readonly TURNSTILE_SECRET_KEY: string;
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_TURNSTILE_SITE_KEY: string;
}

declare module "@tanstack/table-core" {
  interface ColumnMeta<TData extends RowData> {
    pin?: "left" | "right";
  }
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
  }
}
