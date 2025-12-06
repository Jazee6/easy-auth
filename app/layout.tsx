import "./globals.css";
import type React from "react";
import { Toaster } from "sonner";
import AlertDialog from "@/components/alert-dialog";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Easy Auth",
  description: "Self-hosted Better Auth OIDC & SSO provider",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <AlertDialog />
      </body>
    </html>
  );
}
