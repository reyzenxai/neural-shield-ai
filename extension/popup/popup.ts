import { getStoredAuth, getValidToken, clearStoredAuth } from "../src/auth";
import { batchAnalyze } from "../src/api";
import { RISK_COLORS, RISK_LABELS } from "../src/config";

const $ = (id: string) => document.getElementById(id)!;

function signalColor(weight: number): string {
  if (weight <= 0) return "#22c55e";
  if (weight >= 60) return "#ef4444";
  if (weight >= 30) return "#f97316";
  return "#eab308";
}

function renderSignIn(): void {
  $("main").innerHTML = `
    <div class="signin-box">
      <p>Sign in to Neural Shield to scan this page.</p>
      <button class="btn btn-primary" id="goSignIn">Sign In</button>
    </div>`;
  $("goSignIn").addEventListener("click", () =>
    chrome.runtime.openOptionsPage(),
  );
}

function renderLoading(): void {
  $("main").innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Scanning…
    </div>`;
}

function renderError(msg: string): void {
  $("main").innerHTML = `<div class="error-box">${msg}</div>`;
}

function renderResult(
  riskLevel: string,
  riskScore: number | null,
  confidence: number,
  verdictLabel: string,
  signals: Array<{ id: string; label: string; weight: number }>,
  url: string,
): void {
  const color = RISK_COLORS[riskLevel] ?? RISK_COLORS["unknown"];
  const label = RISK_LABELS[riskLevel] ?? riskLevel;
  const scoreText = riskScore !== null ? `Score ${riskScore.toFixed(0)}/100` : "";
  const confPct = Math.round(confidence * 100);

  const topSignals = signals.filter((s) => s.weight > 0).slice(0, 3);
  const negSignals = signals.filter((s) => s.weight <= 0).slice(0, 1);
  const shownSignals = [...topSignals, ...negSignals];

  const signalsHtml =
    shownSignals.length === 0
      ? `<div class="no-signals">No risk indicators found.</div>`
      : shownSignals
          .map(
            (s) => `
        <div class="signal-item">
          <div class="signal-dot" style="background:${signalColor(s.weight)}"></div>
          <span class="signal-label">${s.label}</span>
          <span class="signal-weight">${s.weight > 0 ? "+" : ""}${s.weight}</span>
        </div>`,
          )
          .join("");

  const reportUrl = encodeURIComponent(url);

  $("main").innerHTML = `
    <div class="verdict-card" style="--risk-color:${color}">
      <div class="verdict-top">
        <span class="verdict-badge">${label}</span>
        <span class="verdict-score">${scoreText}</span>
      </div>
      <div class="verdict-label">${verdictLabel}</div>
      <div class="conf-row">
        <span class="conf-label">Confidence</span>
        <div class="conf-bar"><div class="conf-fill" style="width:${confPct}%"></div></div>
        <span style="font-size:10px;color:#64748b;min-width:28px;text-align:right">${confPct}%</span>
      </div>
    </div>
    <div class="signals-title">Indicators</div>
    ${signalsHtml}
    <div class="actions">
      <button class="btn btn-outline" id="rescan">Rescan</button>
      <button class="btn btn-danger" id="reportBtn">Report Scam</button>
    </div>`;

  $("rescan").addEventListener("click", () => init());
  $("reportBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: `https://neural-shield-ai.vercel.app/scan?prefill=${reportUrl}` });
  });
}

async function scanCurrentTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  $("urlStrip").textContent = url || "No URL detected";

  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    $("main").innerHTML = `<div class="no-signals" style="padding:20px 0">
      This page cannot be scanned (not an http/https URL).</div>`;
    return;
  }

  renderLoading();

  const token = await getValidToken();
  if (!token) { renderSignIn(); return; }

  try {
    const results = await batchAnalyze([{ type: "url", value: url }], token);
    const r = results[0];
    if (!r) { renderError("No result returned."); return; }
    renderResult(r.riskLevel, r.riskScore, r.confidence, r.verdictLabel ?? r.riskLevel, r.signals, url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("401") || msg.includes("403")) {
      await clearStoredAuth();
      renderSignIn();
    } else {
      renderError(`Scan failed: ${msg}`);
    }
  }
}

async function init(): Promise<void> {
  $("settingsLink").addEventListener("click", () => chrome.runtime.openOptionsPage());

  const auth = await getStoredAuth();
  $("footerEmail").textContent = auth?.email ?? "";

  // Load engine version in header (best-effort).
  try {
    const { fetchExtensionConfig } = await import("../src/api");
    const cfg = await fetchExtensionConfig();
    $("engineVersion").textContent = cfg.engineVersion;
  } catch {
    // silent
  }

  await scanCurrentTab();
}

init();
