// Supabase anon key is intentionally public (client-side credential, protected by RLS).
export const SUPABASE_URL = "https://jdcilinhabwilvbrjwjp.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkY2lsaW5oYWJ3aWx2YnJqd2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTMzMzYsImV4cCI6MjA5NzA4OTMzNn0.ubFVj0zJe2TDE9qw2pCLYGBt_ItNafcDAsu4zZxBvAY";

export const DEFAULT_API_URL = "http://localhost:5000";

export const RISK_COLORS: Record<string, string> = {
  safe: "#22c55e",
  low: "#84cc16",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
  unknown: "#6b7280",
  error: "#6b7280",
};

export const RISK_LABELS: Record<string, string> = {
  safe: "Safe",
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical",
  unknown: "Unknown",
  error: "Error",
};
