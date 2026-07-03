# NSIE — Model Security

> Adversarial robustness, data integrity, and operational security for the NSIE ML pipeline.
> Related: [`ml-architecture.md`](ml-architecture.md), [`data-pipeline.md`](data-pipeline.md),
> [`model-deployment.md`](model-deployment.md).

---

## 1. Threat Model

NSIE operates in an adversarial environment. Scammers have economic incentive to:

1. **Evade detection:** craft inputs that score low risk (false negatives)
2. **Poison training data:** submit feedback that degrades the model's accuracy over time
3. **Abuse the API:** scan their own content to probe the scoring function
4. **Attack the infrastructure:** compromise the model files or the scoring pipeline

Each threat requires a distinct countermeasure.

---

## 2. Adversarial Evasion

### 2.1 Attack types

**Rule evasion (current threat):**
Scammers already probe rule-based systems. Common techniques:
- Replacing keywords with synonyms ("OTP" → "one time code", "blocked" → "suspended")
- Adding noise characters ("bl0cked", "ur-gent")
- Using homoglyph characters (Cyrillic а vs. Latin a)
- URL obfuscation (redirects, URL shorteners, base64-encoded paths)

**ML evasion (future threat once ML is deployed):**
- Adding innocent-seeming text to dilute risk signals
- Exploiting feature gaps (inputs the model hasn't seen)
- Gradient-based attacks (for white-box access — adversary knows the model)

### 2.2 Current defenses (rule engine)

The deterministic rule engine's category caps are an inherent defense against noise injection: adding more content can't push `content` category above 35. An attacker can't overcome a hard TI override (GSB, PhishTank) by adding innocent-sounding text.

RDAP domain age is immutable — a newly registered domain will always trigger `domain.age_lt_7d` regardless of how the URL looks otherwise.

### 2.3 Adversarial training for ML

When training the ML model, include adversarially perturbed examples:

**Text augmentation for evasion resistance:**
- Random character substitutions in scam-signal words (simulate l33tspeak)
- Insertion of benign filler sentences before/after scam content
- Synonym replacement for urgency words
- Deliberate misspellings of brand names

```python
def augment_scam_text(text: str) -> list[str]:
    """Generate evasion-variant examples for adversarial training."""
    variants = [text]
    
    # Leet-speak substitution
    leet = text.translate(str.maketrans("aeios", "43105"))
    variants.append(leet)
    
    # Add filler prefix
    variants.append(f"Hope you're having a great day! {text}")
    
    # Split keywords with spaces
    variants.append(text.replace("OTP", "O T P").replace("URGENT", "U R G E N T"))
    
    return variants
```

These augmented examples are labeled as `scam` in the training set. The model learns that these evasion techniques don't change the underlying semantics.

**URL feature robustness:**
Features based on external, hard-to-fake data (domain age, TI hits) are inherently robust. Features based on URL string structure (subdomain depth, TLD) are evadable. The model should assign higher weight to the former class of features — enforced via feature importance analysis during training.

### 2.4 Adversarial test set

Maintain a dedicated adversarial test set containing:
- Known evasion attempts from production (collected from analyst-reviewed false negatives)
- Manually crafted adversarial examples covering common evasion techniques
- At least 500 examples per modality

This set is used to evaluate adversarial recall at every training cycle. A model that gains overall precision/recall but loses adversarial recall is not promoted.

---

## 3. Data Poisoning Defense

### 3.1 Attack surface

The community feedback mechanism (`submitFeedback`) is the primary data poisoning surface. A coordinated attack could:
- Report legitimate content as scam (false positive poisoning)
- Report scam content as legitimate (false negative poisoning)

### 3.2 Defenses

**Report weighting:** community reports are weighted by account age, plan tier, and historical report accuracy. A new free-tier account's reports contribute minimally to `weighted_report_score`.

**Rate limiting on feedback:** a single user can submit at most 10 reports per day. This limits the impact of a single compromised account.

**Consensus requirement:** the `community_override` signal (hard malicious override) requires WS ≥ 8, which requires multiple high-weight reporters agreeing. A single malicious reporter cannot trigger an override.

**Label source hierarchy:** analyst-confirmed labels override community labels. Auto-labels (from hard TI overrides with confidence ≥ 0.95) are treated as analyst-equivalent for training purposes. Community-only labels contribute to training at 50% sample rate (randomly sampled each training cycle).

**Anomaly detection on the label stream:**
Monitor the incoming label stream for:
- Sudden spike in `is_accurate = false` reports for a specific entity type (coordinated reporting campaign)
- High-accuracy entities suddenly accumulating negative reports (entity previously clean, reports inconsistent with TI data)
- Single user submitting > 50 reports in 24 hours (rate limit + alert)

Any anomaly triggers a hold on using those labels in the next training cycle until manually reviewed.

### 3.3 Training data integrity

Training datasets are DVC-tracked with checksums. The training pipeline verifies dataset integrity before each run:

```python
import hashlib
import json

def verify_dataset(path: str, expected_hash: str) -> bool:
    with open(path, "rb") as f:
        actual_hash = hashlib.sha256(f.read()).hexdigest()
    return actual_hash == expected_hash

# Checked at training start; training aborts if hash mismatch
assert verify_dataset("data/splits/train.parquet", EXPECTED_HASH)
```

Dataset hashes are stored in `dvc.lock` (committed to git). Any unauthorized modification of the training data is detectable before training begins.

---

## 4. Model Artifact Security

### 4.1 ONNX model integrity

Model files are signed with a private key before upload to blob storage. The edge function verifies the signature before loading the model:

```typescript
import { createVerify } from "crypto";

async function loadModelSecure(modelPath: string): Promise<Buffer> {
  const [modelBytes, sigBytes] = await Promise.all([
    fetch(modelPath).then(r => r.arrayBuffer()),
    fetch(modelPath + ".sig").then(r => r.arrayBuffer()),
  ]);
  
  const verify = createVerify("SHA256");
  verify.update(Buffer.from(modelBytes));
  
  const valid = verify.verify(
    process.env.MODEL_SIGNING_PUBLIC_KEY!,
    Buffer.from(sigBytes)
  );
  
  if (!valid) throw new Error("Model integrity check failed — refusing to load");
  return Buffer.from(modelBytes);
}
```

The private signing key is stored in the training environment (GitHub Actions secret). The public verification key is in the edge function environment. A compromised model file (e.g. supply chain attack on blob storage) is rejected before inference.

### 4.2 Access control on model artifacts

- Model files in blob storage: read-only for the edge function service account; write access only from the training CI pipeline's service account
- MLflow model registry: read access for deployment, write access for the training pipeline only
- DVC remote (S3/GCS): versioned, bucket policy prevents deletion

### 4.3 Model extraction prevention

NSIE's ML model outputs a `P(scam)` score, not the raw model weights. The ONNX model file itself is never exposed to end users.

Defense against model extraction (adversary queries the API to reconstruct the model):
- API rate limiting (5–100 scans/day depending on plan)
- Random noise added to low-confidence predictions: `if (confidence < 0.3) output += gaussian_noise(0, 0.05)`
- Detection: alert if a single user submits > 500 similar queries in 24 hours (systematic probing pattern)

---

## 5. Operational Security of the Scoring Pipeline

### 5.1 AI explanation security

Claude (via OpenRouter) receives the verdict and signal labels — not raw user input content. This prevents prompt injection attacks in the explanation layer:

```typescript
const explainInput = {
  entityType: original.type,
  verdict: { riskLevel, trustScore, confidence },
  signals: signals.map(s => ({ id: s.id, label: s.label })),  // labels only, not evidence
  rawContext: content,  // raw content is included but Claude is instructed not to execute it
};
```

The system prompt for Claude explicitly instructs it not to execute any instructions found in the content being analyzed. The raw content is included only for language-naturalness in the explanation.

### 5.2 Secret management

All API keys for TI collectors (VirusTotal, AbuseIPDB, Google Safe Browsing) are environment variables, never hardcoded. Rotation procedure:
- Quarterly rotation of all TI API keys
- Immediate rotation if a key appears in logs, error messages, or is suspected compromised
- Keys are different across development, staging, and production environments

### 5.3 Input sanitization

User-supplied scan content is never executed or interpreted as code. The engine applies:
- Length limits (max 10,000 characters for text inputs, enforced at the API layer)
- Type validation (scan type must be one of the allowed enum values)
- Content is passed to rule engine as an opaque string — only regex matching, never eval

URLs are expanded using `expandUrl()` which follows redirects but does not render pages. The HTTP client (axios) does not execute JavaScript.

---

## 6. Privacy-Preserving ML

### 6.1 No PII in model inputs

Feature extraction never includes raw PII as model inputs:
- Email addresses → domain only (not full address)
- Phone numbers → structural features (prefix, length, format validity), not the digit sequence itself
- UPI IDs → structural features (PSP suffix, handle keyword flags), not the full VPA

A trained model cannot reconstruct a user's email or phone number from its weights.

### 6.2 Differential privacy (Phase 3)

For very sensitive features (phone number patterns, email domain distributions), applying differential privacy (DP) during training adds calibrated noise to gradients, preventing individual training examples from being reconstructable from model weights.

LightGBM supports DP training via the `privacy_budget` parameter (ε). Trade-off: smaller ε = stronger privacy = lower model accuracy. Target: ε = 2.0 (good privacy-utility balance at our scale).

Phase 3 implementation (see [`future-roadmap.md §5`](future-roadmap.md)).

---

## 7. Incident Response

If a model security incident is detected (compromised model file, data poisoning discovered, successful evasion at scale):

1. **Immediate:** roll back to previous model version (< 5 minutes, see [`model-deployment.md §6`](model-deployment.md))
2. **Within 1 hour:** identify affected scans (query `scans` table by `engine_version` / `ml_version`)
3. **Within 24 hours:** revoke compromised credentials, rotate affected keys
4. **Within 72 hours:** root cause analysis, remediation committed to code
5. **Next training cycle:** retrain with poisoned labels excluded, re-evaluate adversarial test set
6. **Post-incident:** update threat model and defenses documented in this file
