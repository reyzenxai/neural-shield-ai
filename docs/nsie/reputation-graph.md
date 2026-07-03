# NSIE — Reputation Graph

> Community reputation system. Source: `backend/src/engine/reputation.ts`.
> Database schema: [`database.md`](../database.md), `reputation-database.md`.
> Architecture context: [`trust-engine-architecture.md §6`](../trust-engine-architecture.md).

---

## 1. Role in NSIE

The reputation engine is the only layer of NSIE that learns from user behavior without requiring ML model retraining. Every time a user reports a scan result as inaccurate — or when a scan verdict is confirmed by subsequent reports — the reputation database updates and future scans of the same entity reflect that accumulated knowledge.

This creates a feedback loop: NSIE gets better on repeated threats (known scam phone numbers, active phishing domains) through community signal aggregation, not rule updates.

---

## 2. Data Model

### 2.1 Entities

Every scannable artifact — URL, domain, phone number, UPI ID, email address — is stored as a canonical entity:

```
entity_type: url | domain | email | phone | upi | text
entity_value: canonical form (lowercased domain, E.164 phone, VPA for UPI)
```

Canonicalization happens in `normalize.ts` before any DB operations. This ensures `HDFC-Bank.com`, `hdfc-bank.com`, and `http://hdfc-bank.com/` all map to the same entity.

### 2.2 Reports

User-submitted feedback from `submitFeedback()`:

```
scan_id       → links back to the source scan
is_accurate   → bool (false = "this result is wrong")
comment       → optional free text
```

Reports are the raw input. The `app_get_reputation` RPC aggregates them into a `weighted_report_score` rather than exposing raw counts, which prevents a single user from manipulating the system.

### 2.3 Cached Intel

The TI collectors write their results to a reputation cache (per entity, per source, with TTL). The `app_get_reputation` RPC returns this alongside community reports, so the reputation engine sees:

```typescript
interface ReputationData {
  report_count: number;
  weighted_report_score: number;
  intel: Array<{ source: string; verdict: string; fetched_at: string }>;
}
```

---

## 3. Weighted Report Scoring

Raw report count is insufficient — it can be gamed, and a single expert report from a verified source is worth more than 10 anonymous reports. The `weighted_report_score` (WS) is computed in the Supabase RPC using the following factors:

- **Report recency:** reports older than 30 days are half-weighted; older than 90 days, quarter-weighted. This ensures the score reflects current threat landscape, not historical incidents.
- **Reporter quality:** verified accounts (Pro/Business plan holders who have been active for 30+ days) contribute 1.5× the weight of free-tier reporters.
- **Consensus:** if ≥ 3 independent reporters agree (and no reporter has flagged an inaccurate report on this entity), the score is amplified.

The exact formula is in the Supabase SQL function `app_get_reputation`. The weights above are the design intent; actual SQL coefficients should be kept in sync with this doc.

---

## 4. Signal Thresholds

The `reputationSignals()` function maps `weighted_report_score` (WS) to signals:

| WS threshold | Signal | Weight | Tier | Effect |
|-------------|--------|--------|------|--------|
| WS ≥ 8 | `reputation.community_override` | 100 | 1 | Hard malicious override → R=100 |
| WS ≥ 2 | `reputation.community_abuse` | 50 | 2 | Strong community scam signal |
| WS ≥ 0.5 | `reputation.prior_scam_verdict` | 30 | 2 | Weak prior confirmation |
| WS = 0, clean intel | `reputation.clean_history` | −15 | 2 | Trust boost (no reports + verified safe TI) |

The `community_override` confidence is `min(0.95, 0.7 + WS × 0.02)`, so it scales with the strength of community evidence but caps at 0.95.

---

## 5. Propagation Design (Current)

The current reputation engine is entity-scoped: each entity's score is independent. There is no graph traversal or score propagation.

**Limitation:** a scam operation that rotates through 50 phone numbers gets no reputation benefit from the first 49 reports if each number is treated independently. The reputation engine only learns about numbers that have been directly reported.

---

## 6. Graph Extension (NSIE v2)

The planned reputation graph extends the current model with entity relationships and PageRank-style score propagation.

### 6.1 Graph Schema

**Nodes:** every entity (domain, IP, phone, UPI VPA, email, ASN, registrar)

**Edge types:**

| Edge | Source → Target | Decay factor |
|------|----------------|--------------|
| `resolves_to` | domain → IP | 0.8 |
| `hosted_on` | domain → ASN | 0.6 |
| `registered_by` | domain → registrar | 0.5 |
| `same_registrant` | domain → domain | 0.7 |
| `same_phone` | entity → phone | 0.9 |
| `same_upi_owner` | UPI → phone | 0.85 |
| `co-reported` | entity → entity (both in same scam report) | 0.7 |

### 6.2 Score Propagation

When entity A receives a reputation hit, its score propagates to neighbors:

```
score(B) += score(A) × edge_weight(A→B) × time_decay(edge_age)
```

Time decay: `exp(-edge_age_days / 90)` — edges older than 90 days contribute at ~37% weight; edges older than 6 months contribute at ~7%.

This allows NSIE to flag a newly registered domain (no direct reports) if it resolves to an IP that previously hosted known scam domains, or if it shares a registrar with 5 recently reported phishing sites.

### 6.3 Anti-Gaming

Propagation has a depth limit (max 2 hops) and a minimum score floor below which propagation doesn't continue. This prevents a single reported entity from poisoning unrelated entities through long graph chains.

Only edges from the last 30 days are used for propagation by default (configurable per edge type). An old connection between two domains shouldn't permanently link their reputation if they've since been reassigned.

### 6.4 Implementation Path

Phase 1: store entity relationships in Postgres (domain-to-IP mappings from DNS results, co-reported entity pairs from scan data). Use recursive CTEs for 2-hop traversal.

Phase 2: if query latency exceeds 200ms at scale, migrate to a dedicated graph store (Neo4j or Amazon Neptune). The reputation engine's external interface (`reputationSignals()`) stays the same; only the backing store changes.

Phase 3: weekly offline PageRank computation over the full entity graph. Pre-compute propagated scores, cache in Redis with daily refresh. This makes real-time queries O(1) again.

---

## 7. Reputation Bootstrap Problem

New entities with zero reports always start at WS=0. The `reputation.clean_history` signal (−15) fires only when there are zero reports AND TI collectors found all-safe results. This provides a small trust boost for entities that have been verified by external sources but not yet reported.

For new entities with no TI data and no reports, the reputation layer contributes nothing — the verdict is determined entirely by rules, structural signals, and domain age. This is intentional: the absence of bad reputation is not the same as having good reputation.

---

## 8. Privacy Considerations

Entity values stored in the reputation database:
- **URLs:** stored at domain level only (no paths or query strings). Full URLs are never stored in the reputation table.
- **Phone numbers:** stored in E.164 format with only the national number (no subscriber details).
- **UPI IDs:** stored as VPA (the `handle@psp` string), which is a public payment identifier.
- **Email:** stored at domain level only. Individual email addresses are not persisted in the reputation table.

Report submissions are linked to `scan_id` (not user ID) in the public reputation table. User attribution is stored separately with RLS restrictions.
