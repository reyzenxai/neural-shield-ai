# ml

Home for the learned models that NSIE v3 will add on top of today's deterministic
threat engine. Nothing here decides a verdict yet. The current engine lives in
`../threat-engine` and produces every score from auditable rules and collectors.

When model serving lands, this is where the ONNX runtime hooks, feature adapters,
and model version loading will live, kept separate from the threat engine so the
deterministic path stays the source of truth. See `docs/nsie/ml-architecture.md`
and `docs/nsie/model-deployment.md` for the plan.
