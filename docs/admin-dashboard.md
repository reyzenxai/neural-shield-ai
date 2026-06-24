# Admin Dashboard

Founder/admin console for Neural Shield AI. All routes under `/admin/*` require an authenticated user with `is_admin = true` in their Supabase profile.

## Security Model

| Layer | Mechanism |
|---|---|
| **Network** | All requests require a valid Supabase JWT (`Authorization: Bearer <token>`) |
| **Backend** | `authenticate` middleware + `requireAdmin()` guard — returns 403 if `isAdmin` is not true |
| **Database** | SECURITY DEFINER RPCs verify `auth.uid()` has `is_admin = true` before executing |
| **Frontend** | Server-side `AdminLayout` reads the profile and redirects to `/dashboard` if not admin |
| **RLS** | `admin_logs` table has policies: SELECT requires `is_admin = true`; INSERT requires `admin_id = auth.uid()` |

Passwords, password hashes, authentication tokens, and API keys are **never** returned by any admin endpoint.

## Architecture

```
Browser (Admin)
  ↓ JWT
Frontend AdminLayout [Server Component]
  → checks auth.uid() + profiles.is_admin → redirect if not admin
  ↓
AdminShell [Client Component — sidebar + layout]
  ↓ axios (auto-attaches JWT)
Backend /api/admin/*
  → authenticate() middleware
  → requireAdmin() guard (403 if not admin)
  ↓
admin.controller.ts
  → getUserClient(token).rpc("admin_get_*", {...})
  ↓
Supabase SECURITY DEFINER RPC
  → verifies auth.uid() has is_admin = true
  → executes cross-user query with postgres privileges
  → returns JSONB result
```

## API Endpoints

All endpoints: `GET /api/admin/*` — require `Authorization: Bearer <supabase_jwt>`.

| Endpoint | Description | Query params |
|---|---|---|
| `GET /api/admin/stats` | Platform-wide aggregate stats | — |
| `GET /api/admin/users` | Paginated user list | `limit`, `offset`, `search`, `plan`, `sort_by`, `sort_dir` |
| `GET /api/admin/users/:id` | Full user detail | — |
| `GET /api/admin/scans` | Paginated scan history | `limit`, `offset`, `risk_level`, `scan_type`, `date_from`, `date_to`, `user_id` |
| `GET /api/admin/feedback` | Paginated user feedback | `limit`, `offset` |
| `GET /api/admin/logs` | Paginated audit log | `limit`, `offset` |

### Response envelope

All endpoints use the standard success envelope:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Error responses:
- `401` — missing or invalid JWT
- `403` — authenticated but not admin (`is_admin = false`)
- `500` — database error

## Database Schema

### profiles (extended)

```sql
ALTER TABLE public.profiles
  ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
```

### admin_logs

```sql
CREATE TABLE public.admin_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      text        NOT NULL,   -- 'view_stats' | 'view_users' | 'view_user' | 'view_scans' | ...
  resource    text        NOT NULL,   -- 'user' | 'scan' | 'feedback' | 'system'
  target_id   uuid,
  ip_address  text,
  user_agent  text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Indexes: `admin_id`, `created_at DESC`, `action`.

### SECURITY DEFINER Functions

| Function | Purpose |
|---|---|
| `admin_is_admin()` | Returns true if `auth.uid()` has `is_admin = true` |
| `admin_get_stats()` | Aggregate platform stats (counts, distributions, time series) |
| `admin_get_users(limit, offset, search, plan, sort_by, sort_dir)` | Paginated user list with scan counts |
| `admin_get_user(id)` | Single user detail + recent scans |
| `admin_get_scans(limit, offset, risk_level, scan_type, date_from, date_to, user_id)` | Paginated scan history |
| `admin_get_feedback(limit, offset)` | Paginated feedback with scan context |
| `admin_get_logs(limit, offset)` | Paginated audit log |

All functions raise `SQLSTATE 42501` ("Access denied") if the calling JWT is not from an admin user.

## Frontend Pages

| Route | File | Description |
|---|---|---|
| `/admin/dashboard` | `(admin)/dashboard/page.tsx` | 6 stat cards + 4 Recharts charts |
| `/admin/users` | `(admin)/users/page.tsx` | Searchable, filterable user table |
| `/admin/users/[id]` | `(admin)/users/[id]/page.tsx` | User profile + risk pie + recent scans |
| `/admin/scans` | `(admin)/scans/page.tsx` | Scan history with risk/type/date filters |
| `/admin/feedback` | `(admin)/feedback/page.tsx` | User feedback with accurate/inaccurate flags |
| `/admin/logs` | `(admin)/logs/page.tsx` | Admin audit log |

Layout: `(admin)/layout.tsx` — server-side admin guard + `AdminShell` client wrapper.

## Granting Admin Access

Run in Supabase SQL Editor (or via migration):

```sql
UPDATE public.profiles
SET is_admin = true
WHERE email = 'founder@example.com';
```

There is intentionally no UI to promote users to admin — this must be done at the database level to prevent privilege escalation.

## Audit Actions Logged

| Action | When |
|---|---|
| `view_stats` | Admin loads the dashboard |
| `view_users` | Admin fetches the users list |
| `view_user` | Admin opens a user detail page |
| `view_scans` | Admin loads the scan history |
| `view_feedback` | Admin loads the feedback page |

Each log entry includes: admin ID, action, resource type, target ID (if applicable), IP address, User-Agent, and a metadata object with filter params.

## Deployment

No additional environment variables are required. The admin system uses the same Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) as the rest of the backend. Access control is enforced entirely through `is_admin` in the database.

After deploying, apply the migration:

```bash
supabase db push
# or: supabase migration up
```

Then grant admin to the first user via Supabase SQL Editor.
