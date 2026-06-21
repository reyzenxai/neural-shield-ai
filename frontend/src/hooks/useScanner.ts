"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ScanError } from "@/services/scanner";
import type { SavedScan } from "@/types";

interface ScannerState {
  result: SavedScan | null;
  loading: boolean;
  error: string | null;
}

/**
 * Drives a single scanner panel: runs an async scan function and tracks
 * loading / result / error. On success it invalidates the cached scans list so
 * the dashboard and history refresh with the new result.
 */
export function useScanner() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ScannerState>({
    result: null,
    loading: false,
    error: null,
  });

  const run = async (fn: () => Promise<SavedScan>) => {
    setState({ result: null, loading: true, error: null });
    try {
      const result = await fn();
      setState({ result, loading: false, error: null });
      if (result.scanId) {
        void queryClient.invalidateQueries({ queryKey: ["scans"] });
      }
    } catch (err) {
      const message =
        err instanceof ScanError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Analysis failed. Please try again.";
      setState({ result: null, loading: false, error: message });
    }
  };

  const reset = () => setState({ result: null, loading: false, error: null });

  return { ...state, run, reset };
}
