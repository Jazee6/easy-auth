import "./globals.css";
import type React from "react";
import { Toaster } from "sonner";
import AlertDialog from "@/components/alert-dialog";

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
