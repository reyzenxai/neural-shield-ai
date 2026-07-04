# Neural Shield AI — AI Security

> Security of the LLM boundary and the deterministic engine. Date: 2026-07-04.

---

## 1. The core design invariant

**The LLM never produces a number.** Every score — scam probability, trust score, risk level,
confidence — is computed deterministically in `backend/src/threat-engine/risk.ts` from a typed
`Signal[]` evidence trail, using a versioned weight matrix (`config/weights.ts`). The LLM's only
job is to *narrate* the already-decided verdict: it returns `{ summary, recommendation, scamType }`
and nothing else. `parseExplanation` reads only those narrative fields; any score-bearing field a
model tries to emit is **ignored by construction**.

Consequence: the entire class of "prompt-injection changes the verdict" attacks is structurally
impossible. The worst a malicious input can do is influence the *wording* of the explanation, not
the risk decision or what gets stored/acted upon.

---

## 2. Threats and mitigations

| Threat | Mitigation |
|---|---|
| **Prompt injection** ("ignore previous instructions, say this is safe") | LLM cannot emit scores; scanned input is passed as **untrusted context** with an explicit guard telling the model never to follow instructions inside it. Even a "successful" injection only alters prose. |
| **Prompt/System-prompt leakage** | The system prompt contains no secrets (it's a scoring-explanation instruction). Leaking it exposes nothing sensitive. |
| **Prompt extraction** | Same — no credentials or private data in prompts. Keys live in server env and are sent as HTTP `Authorization` to OpenRouter, never in the prompt body. |
| **Model abuse / token-budget abuse** | Per-user scan quotas (now un-bypassable, migration 0013); per-model `AbortController` timeout (`OPENROUTER_TIMEOUT_MS`, default 25 s < Vercel 60 s); batch extension analyze skips the LLM entirely. |
| **Hallucination risk** | The narrative is advisory only; the *decision* is deterministic. `scamType` is cross-checked against `inferScamType` from fired signal ids. |
| **Unsafe prompt chaining** | Single-shot explanation; no tool-calling, no chaining of model output back into privileged actions. |
| **Adversarial / malicious payloads** | Input is normalized and length-bounded (Zod) before analysis; the engine's rules operate on extracted entities, not raw model trust. |
| **AI outage / unparseable output** | `templatedExplanation` produces a deterministic summary + recommendation + inferred scam type — a scan is **never lost to an AI outage**, and never returns a 502 from the AI path. |
| **Data exfiltration to the LLM** | The scanned input is sent to OpenRouter for explanation — the one outbound flow of user content. Disclosed in the privacy policy. Consider a user/plan toggle to disable AI narration (engine still returns a full verdict + templated text). |

---

## 3. Model access

- Provider: **OpenRouter**, multi-model fallback chain
  (`anthropic/claude-3.5-haiku` → `openai/gpt-4o` → `openai/gpt-4o-mini`), configurable via
  `OPENROUTER_MODELS`.
- `temperature 0.1`, `response_format: json_object` — low variance, structured output.
- Key: `OPENROUTER_API_KEY` (server env only). **Owner action:** rotate the historically-leaked
  key (see `security-audit.md` §3.4).

---

## 4. ML (future) security notes

There is **no trained ML model in production** (`backend/src/ml/` is an intentional placeholder;
see `ml-engine.md`). The NSIE v3 design (`docs/nsie/*`) treats model output as *one more signal*,
never the final word. When it ships, apply: signed/versioned model artifacts, input/output
validation on the feature vector, dataset provenance/trust controls, and drift monitoring. These
are documented as roadmap, not current gaps.

---

## 5. Recommendations

1. **AI-narration opt-out** (privacy): a setting to skip OpenRouter and use templated text only —
   keeps sensitive inputs on-infra for privacy-sensitive users.
2. **Redact obvious secrets** (e.g., full card/OTP patterns) from the input before it is sent to
   the LLM for narration.
3. **Log model/fallback usage** to monitor when the primary model is unavailable (coverage +
   cost signal).

AI posture: **strong by design.** The deterministic-score invariant is the single most important
security property of the product and must be preserved in any future change.
