import type { AuthUser } from "./index";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user, populated by the auth middleware. */
      user?: AuthUser;
      /** Raw Supabase access token, used to build an RLS-scoped DB client. */
      userToken?: string;
      /** SHA-256 hash of the presented API key (set when auth is via API key). */
      apiKeyHash?: string;
    }
  }
}

export {};
