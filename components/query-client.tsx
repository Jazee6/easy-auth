"use client";

import { QueryClientProvider, QueryClient as QC } from "@tanstack/react-query";
import { ReactNode } from "react";

const queryClient = new QC();

const QueryClient = ({ children }: { children: ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export default QueryClient;
