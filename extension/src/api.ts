import { getApiUrl } from "./auth";

export interface Entity {
  type: "url" | "domain" | "email" | "phone" | "upi" | "text";
  value: string;
}

export interface EntityResult {
  type: string;
  value: string;
  riskScore: number | null;
  riskLevel: string;
  confidence: number;
  verdictLabel?: string;
  signals: Array<{ id: string; label: string; weight: number; category: string }>;
  engineVersion?: string;
  error?: string;
}

export interface BatchResponse {
  success: boolean;
  data?: { results: EntityResult[] };
  message?: string;
}

export interface ExtensionConfig {
  engineVersion: string;
  engineV2: boolean;
  thresholds: { critical: number; high: number; medium: number; low: number };
  maxBatchSize: number;
  supportedTypes: string[];
}

export async function batchAnalyze(
  entities: Entity[],
  token: string,
): Promise<EntityResult[]> {
  const apiUrl = await getApiUrl();
  const res = await fetch(`${apiUrl}/api/extension/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ entities }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  const data = (await res.json()) as BatchResponse;
  return data.data?.results ?? [];
}

export async function fetchExtensionConfig(): Promise<ExtensionConfig> {
  const apiUrl = await getApiUrl();
  const res = await fetch(`${apiUrl}/api/extension/config`);
  if (!res.ok) throw new Error(`Config fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as { data?: ExtensionConfig };
  if (!data.data) throw new Error("Invalid config response");
  return data.data;
}
