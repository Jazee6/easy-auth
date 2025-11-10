import "./globals.css";
import type React from "react";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children} <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
