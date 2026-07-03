/**
 * One import site for the shared workspace packages. Components and hooks can
 * pull risk labels, scan schemas, and the scan client from here instead of
 * redefining them. Adoption is incremental: existing code keeps working, and new
 * or refactored code can move onto these shared definitions.
 */

export { RISK_LABELS, RISK_COLORS, PLAN_LIMITS, SCAN_TYPES } from "@neural-shield/config";
export type { ScanTypeConfig } from "@neural-shield/config";

export {
  MessageScanSchema,
  UrlScanSchema,
  EmailScanSchema,
  PhoneScanSchema,
  UpiScanSchema,
} from "@neural-shield/validation";

export { createScanClient, buildScanPayload, ScanApiError } from "@neural-shield/sdk";
export type { ScanClient } from "@neural-shield/sdk";
