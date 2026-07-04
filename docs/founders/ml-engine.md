# ML Engine

> **Status: roadmap, not shipped.** There is no trained machine-learning model in production today.
> This document exists so nobody mistakes the plan for reality.

## What exists now

- `backend/src/ml/` is an **intentional placeholder** (`index.ts` exports nothing; the README says
  the deterministic threat engine remains the source of truth).
- Today's "classification" is **deterministic**: scam type is inferred from the fired signal ids
  (`inferScamType`) or the LLM's advisory label. No dataset, no training run, no accuracy figure
  exists in the repo.

## What is designed (NSIE v3)

The full learned-model design is written up under `docs/nsie/*` (ml-architecture, model-training,
model-deployment, model-security, feature-engineering, continuous-learning, mlops,
confidence-engine, data-pipeline, reputation-graph, threat-fusion, rule-engine, future-roadmap,
nsie-overview). Key principles:

- **Models attach as *additional signals*, never the final word.** The deterministic engine stays
  the source of truth; a model's output is fused in like any other signal (via a confidence engine
  and threat-fusion layer).
- Planned serving: ONNX runtime hooks, feature adapters, versioned model loading — kept in
  `src/ml/`, separate from the deterministic engine.
- Training data would come from the existing `scan_signals` evidence trail + community `reports`.

## Why it's built this way

Because verdicts must stay auditable and reproducible. A learned model that could override the score
would reintroduce the exact opacity the deterministic engine was designed to avoid. So the roadmap
keeps the model advisory.

## When it ships, security must include
- Signed, versioned model artifacts (integrity).
- Input/output validation on the feature vector.
- Dataset provenance / trust controls (poisoning resistance).
- Drift monitoring.

See `../ai-security.md` §4.

## Do not
- Do not describe the product to customers/investors as "using trained ML" today — it uses a
  deterministic rules + threat-intel + reputation engine with an LLM explainer.
- Do not treat the empty `src/ml/` directory or `docs/nsie/*` as production defects — they are
  planned architecture.
