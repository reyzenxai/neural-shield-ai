"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteScans, fetchScans } from "@/lib/scans";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAuth } from "@/hooks/useAuth";

/** Load the current user's scans (RLS-scoped), cached via React Query. */
export function useScans() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["scans"],
    queryFn: () => fetchScans(),
    enabled: isSupabaseConfigured && isAuthenticated,
  });
}

/** Delete scans and refresh the cached list. */
export function useDeleteScans() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteScans(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scans"] }),
  });
}
