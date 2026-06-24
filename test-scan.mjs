const [,, email, password, target = "http://evil-phish.xyz/login"] = process.argv;
if (!email || !password) { console.error("Usage: node test-scan.mjs <email> <password> [url]"); process.exit(1); }

const SUPABASE_URL = "https://jdcilinhabwilvbrjwjp.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkY2lsaW5oYWJ3aWx2YnJqd2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTMzMzYsImV4cCI6MjA5NzA4OTMzNn0.ubFVj0zJe2TDE9qw2pCLYGBt_ItNafcDAsu4zZxBvAY";

const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
  body: JSON.stringify({ email, password }),
}).then(r => r.json());

if (!auth.access_token) { console.error("Auth failed:", auth); process.exit(1); }
console.log("✓ Signed in as", email);

const result = await fetch("http://localhost:5000/api/scan/url", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.access_token}` },
  body: JSON.stringify({ url: target }),
}).then(r => r.json());

console.log(JSON.stringify(result, null, 2));
if (result.data?.engineVersion) {
  console.log("\n✓ ENGINE_V2:", result.data.engineVersion);
  console.log("  riskScore:", result.data.riskScore, "| riskLevel:", result.data.riskLevel);
  console.log("  confidence:", result.data.confidence);
  console.log("  signals:", result.data.signals?.length ?? 0);
}
