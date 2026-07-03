# NSIE — Model Deployment

> ONNX export, serving strategy, versioning, rollback, and multi-platform targets.
> Related: [`mlops.md`](mlops.md), [`ml-architecture.md §6`](ml-architecture.md).

---

## 1. Deployment Targets

NSIE serves four distinct runtime environments. The deployment strategy must work across all four without rewriting the model:

| Platform | Runtime | Latency budget | Notes |
|----------|---------|---------------|-------|
| Web app (Vercel) | Node.js Edge Function | 3000ms total | Current production |
| Chrome extension | Browser service worker | 500ms for ML portion | Background scan |
| Mobile (React Native / Expo) | On-device ONNX | 200ms | Future Phase 2 |
| Enterprise API | Node.js + possible containerized | 2000ms | Dedicated infrastructure |

The deterministic rule engine (no ML) serves all four today. The ML layer will be added progressively, starting with the web API.

---

## 2. ONNX — Cross-Platform ML Serving

ONNX (Open Neural Network Exchange) is the deployment format for all NSIE ML models. It provides:
- **Cross-platform:** single model file runs on Node.js, browser (ONNX.js), and mobile (ONNX Runtime Mobile)
- **Language-independent:** trained in Python (LightGBM/PyTorch), inferred in TypeScript
- **Versioned:** ONNX models are opaque binary artifacts — the calling code specifies which version to load

### 2.1 LightGBM → ONNX export

```python
import lightgbm as lgb
from onnxmltools import convert_lightgbm
from onnxconverter_common import FloatTensorType

# Load trained model
model = lgb.Booster(model_file=f"models/head_url_v{VERSION}.lgb")

# Export to ONNX
initial_types = [("float_input", FloatTensorType([None, NUM_FEATURES]))]
onnx_model = convert_lightgbm(
    model,
    initial_types=initial_types,
    target_opset=17,  # ONNX opset version
)

# Save
with open(f"models/nsie-ml-url-v{VERSION}.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())
```

Per-modality models are exported as separate ONNX files. At inference time, only the relevant modality's model is loaded (not all 7).

### 2.2 ONNX Runtime in Node.js

```typescript
import * as ort from "onnxruntime-node";

let session: ort.InferenceSession | null = null;

async function loadModel(modality: string, version: string): Promise<ort.InferenceSession> {
  const modelPath = `models/nsie-ml-${modality}-${version}.onnx`;
  return ort.InferenceSession.create(modelPath, {
    executionProviders: ["cpu"],  // CPU only on Vercel; GPU on future dedicated infra
    graphOptimizationLevel: "all",
  });
}

async function predictScam(
  features: Float32Array,
  modality: string,
): Promise<number> {
  if (!session) session = await loadModel(modality, ML_VERSION);
  
  const tensor = new ort.Tensor("float32", features, [1, features.length]);
  const results = await session.run({ float_input: tensor });
  
  // LightGBM ONNX outputs: label (0/1) and probabilities
  const probs = results["probabilities"].data as Float32Array;
  return probs[1];  // P(scam)
}
```

Model files are stored in Vercel blob storage and loaded on cold start. Warm requests reuse the cached session.

### 2.3 ONNX in the browser (Chrome extension)

```typescript
import { InferenceSession, Tensor } from "onnxruntime-web";

// Loaded once when the service worker starts
let session: InferenceSession | null = null;

async function getSession(): Promise<InferenceSession> {
  if (!session) {
    session = await InferenceSession.create(
      chrome.runtime.getURL("models/nsie-ml-url.onnx"),
      { executionProviders: ["wasm"] }  // WebAssembly backend
    );
  }
  return session;
}
```

ONNX model for the browser must be small (< 5 MB). LightGBM models for URL classification are typically 500 KB–2 MB — acceptable. Image models (CNN) will be quantized to INT8 before browser deployment.

### 2.4 ONNX on mobile (future)

Expo SDK supports ONNX Runtime Mobile via a native module. The mobile app would load the model from the app bundle or a hot-updatable OTA asset:

```typescript
// Future: react-native-onnxruntime or expo-onnx
import { InferenceSession } from "expo-onnxruntime";

const session = await InferenceSession.create(
  require("../assets/models/nsie-ml-text.onnx"),
  { providers: ["cpu"] }
);
```

Mobile inference runs entirely on-device — no network call for the ML prediction. Only TI collector calls require network access.

---

## 3. Model Artifact Structure

Each deployed model version is a bundle of files:

```
dist/models/v{N}/
├── manifest.json                   # version metadata
├── nsie-ml-text.onnx              # text/message classifier
├── nsie-ml-url.onnx               # URL classifier
├── nsie-ml-email.onnx             # email classifier
├── nsie-ml-phone.onnx             # phone classifier
├── nsie-ml-upi.onnx               # UPI classifier
├── nsie-ml-screenshot.onnx        # screenshot classifier (Phase 2)
├── nsie-ml-qr.onnx                # QR classifier
├── feature_stats.json             # normalization params (mean, std per feature)
└── calibrators.json               # isotonic regression calibration tables
```

`manifest.json`:
```json
{
  "ml_version": "nsie-ml@1.2.0",
  "engine_version": "trust-engine@2.1.4",
  "trained_on_dataset": "scans_labeled_20260201",
  "feature_schema_version": "v2",
  "deployed_at": "2026-02-08T04:00:00Z",
  "modalities": ["text", "url", "email", "phone", "upi"],
  "onnx_opset": 17
}
```

---

## 4. Versioning Strategy

Two version namespaces are maintained independently:

```typescript
const ENGINE_VERSION = "trust-engine@2.1.4";  // deterministic engine
const ML_VERSION = "nsie-ml@1.2.0";           // ML model bundle
```

Both are stored in every scan record. This ensures:
- A scan from 2026-01-01 (trust-engine@2.0.0) and a scan from 2026-06-01 (trust-engine@2.2.0) can be compared knowing they used different rule weights
- ML model upgrades don't invalidate rule engine versioning and vice versa

**Semantic versioning for ML models:**
- **Major (1.x → 2.x):** architecture change (new model type, new modalities)
- **Minor (1.1 → 1.2):** retraining with new data, no architecture change, metrics improved
- **Patch (1.1.0 → 1.1.1):** calibration fix or bug fix with no metric impact

---

## 5. Traffic Routing and Rollout

New model versions follow a staged rollout:

| Phase | Traffic % | Duration | Abort if |
|-------|-----------|----------|---------|
| Shadow (logging only) | 0% of scoring | 3 days | Any error in shadow predictions |
| Canary | 1% | 24 hours | P(scam) distribution diverges > 20% from control |
| Gradual | 10% → 50% | 48 hours each | Precision < threshold or any P99 latency > 500ms |
| Full | 100% | — | — |

**Routing implementation:** a hash of `user_id` modulo 100 determines which traffic bucket a request falls into. This ensures consistent user experience — the same user always hits the same model version during a rollout.

```typescript
function getModelVersion(userId: string): string {
  const bucket = hash(userId) % 100;
  if (bucket < CANARY_PERCENT) return ML_VERSION_NEW;
  return ML_VERSION_CURRENT;
}
```

---

## 6. Rollback

Rollback is a single environment variable change:

1. Set `ML_VERSION` back to the previous version in Vercel environment settings
2. Vercel redeploys (< 30 seconds)
3. All new requests use the previous model; cached sessions on warm instances drain within 5 minutes

The previous model's ONNX files remain in blob storage indefinitely (never deleted). Rollback does not require re-training or re-exporting.

**Automated rollback trigger:** if a canary deployment sees `error_rate > 1%` on ML inference calls within the first hour, the canary is automatically rolled back and a Slack alert fires.

---

## 7. Model Loading and Cold Start

On Vercel Edge Functions:
- Cold start: model files downloaded from blob storage → session created → P99 latency 800ms–1500ms (once per function instance)
- Warm: session cached in memory → P99 ML inference latency < 50ms

To minimize cold start impact:
- Pre-warm critical function instances with a scheduled ping every 5 minutes
- Use the smallest ONNX model that meets accuracy requirements (avoid quantization only when necessary for size)
- Load all 7 modality models lazily — only load the modality needed for the incoming scan type

---

## 8. Monitoring in Production

After each deployment, monitor:

| Metric | Source | Alert condition |
|--------|--------|-----------------|
| ML inference latency (P99) | Edge function logs | > 200ms |
| ONNX session load time | Cold start logs | > 2000ms |
| ML prediction distribution | Daily aggregate | Scam rate shifts > 15% vs. baseline |
| Calibration drift | Weekly analyst labels | ECE > 0.08 |
| Model error rate | Edge logs | > 0.1% OnnxRuntime errors |

If any alert fires, the on-call engineer investigates before the next retraining cycle. A severe drift or error rate triggers an emergency rollback.
