import { create } from "zustand";
import type { Profile, ScanResult } from "../constants/types";

interface AuthState {
  session: { access_token: string; user: { id: string; email: string } } | null;
  profile: Profile | null;
  setSession: (s: AuthState["session"]) => void;
  setProfile: (p: Profile) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  clearAuth: () => set({ session: null, profile: null }),
}));

interface ScanState {
  lastResult: ScanResult | null;
  setLastResult: (r: ScanResult) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  lastResult: null,
  setLastResult: (lastResult) => set({ lastResult }),
}));
