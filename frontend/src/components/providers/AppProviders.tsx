"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/Tooltip";
import { useAppStore } from "@/store/useAppStore";

/**
 * Client-side app providers: React Query for data fetching, Supabase session
 * bootstrap on mount, and the tooltip context.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const initialize = useAppStore((s) => s.initialize);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
