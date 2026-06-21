# Performance — Neural Shield AI

## Frontend

| Aspect | Current state | Notes / recommendations |
| --- | --- | --- |
| Rendering | Landing + auth pages **prerendered static**; dashboard routes dynamic behind auth | Good split; static pages are CDN-cached |
| React Compiler | enabled (`reactCompiler: true`) | auto-memoization, fewer manual `useMemo` |
| Data fetching | TanStack Query caches scans; invalidated on a new persisted scan | avoids refetch storms; dashboard + history share the cache |
| Charts | recharts (`RiskDonut`, `TypeBreakdown`) | fine at current data sizes |
| Bundle | axios + supabase-js + recharts + framer-motion are the heavy deps | code-split charts/billing (Razorpay script already lazy-loaded); consider dynamic-importing recharts on the dashboard route |
| Images | SVG assets; avatars via Supabase public CDN with cache-busting query | use `next/image` if raster art is added |

**Hot spot:** `fetchScans` pulls up to **1000** rows and `computeStats` aggregates in the
browser. Smooth today; as a user accumulates scans, move aggregation server-side (a Postgres
view / RPC) and switch history to keyset pagination on the `(user_id, created_at desc)` index.

## Backend

| Aspect | Current state | Notes / recommendations |
| --- | --- | --- |
| Latency | dominated by the OpenRouter call; `processing_time_ms` recorded per scan | now bounded by `OPENROUTER_TIMEOUT_MS` (25s) with failover |
| Cold starts | Vercel serverless cold start + module init (helmet/cors/supabase) | acceptable for an API; container host avoids cold starts if latency-sensitive |
| Persistence | 1 insert (scan) + 1 batched insert (flags) + 1 audit insert per scan | batched flags already; audit is best-effort (failures logged, not fatal) |
| OCR worker | Tesseract worker is a **lazy singleton** with recognitions **serialized** | avoids concurrent-worker issues; first call fetches the model. Unreliable on serverless — use the container host |
| Logging | Winston JSON; file transports skipped on Vercel (read-only FS) | console logs flow to Vercel/Railway log drains |

## Database

| Aspect | State | Notes |
| --- | --- | --- |
| Indexes | hot paths indexed (`scans(user_id, created_at desc)`, `scan_flags(scan_id)`, `audit_logs`, `api_keys`) | covers history, flag joins, audit reads, key lookups |
| RLS overhead | per-query `auth.uid()` checks | negligible vs. the LLM call; the real cost is upstream AI |
| Growth | scans/scan_flags grow with usage | add server-side aggregation + pagination; consider a partial index for high/critical |

## Scalability

- **Backend is stateless** → scale horizontally. **Caveat:** `express-rate-limit` and the
  daily-metering increment are effectively per-instance/in-DB; for multiple backend instances,
  move rate-limit state to **Upstash Redis** and metering into a SECURITY DEFINER
  `consume_scan()` RPC (atomic, tamper-proof).
- **AI cost/latency** is the dominant variable. Order the model chain cheap→capable for
  high-volume text scans; cap `max_tokens`; consider caching identical normalized inputs.
- **DB** scales with Supabase; the indexes and RLS keep per-tenant reads cheap. Watch the
  client-side 1000-row aggregation as the first thing to outgrow.

## Suggested SLOs to track

- p95 scan latency (text) and AI failover rate (from logs / `ai_model` distribution).
- Daily-limit 429 rate (free-tier friction / upgrade signal).
- Error envelope rate by status (502 = AI health, 5xx = unexpected).
- DB: history query time as row counts grow (trigger to add server-side pagination).
