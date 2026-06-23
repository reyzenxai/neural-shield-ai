import { getStoredAuth, signIn, clearStoredAuth, getApiUrl, setApiUrl } from "../src/auth";
import { fetchExtensionConfig } from "../src/api";

const $ = (id: string) => document.getElementById(id)!;

function showStatus(id: string, msg: string, type: "success" | "error" | "info"): void {
  const el = $(id);
  el.textContent = msg;
  el.className = `status ${type}`;
}

function clearStatus(id: string): void {
  const el = $(id);
  el.className = "status";
  el.textContent = "";
}

async function loadEngineConfig(): Promise<void> {
  try {
    const cfg = await fetchExtensionConfig();
    $("cfgVersion").textContent = cfg.engineVersion;
    $("cfgV2").textContent = cfg.engineV2 ? "Enabled" : "Disabled";
    $("cfgBatch").textContent = String(cfg.maxBatchSize);
    $("engineCard").style.display = "block";
  } catch {
    // Engine unreachable — hide the card silently
  }
}

async function updateUI(): Promise<void> {
  const auth = await getStoredAuth();

  if (auth) {
    $("signInCard").style.display = "none";
    $("accountCard").style.display = "block";
    $("userEmail").textContent = auth.email;
  } else {
    $("signInCard").style.display = "block";
    $("accountCard").style.display = "none";
  }

  const apiUrl = await getApiUrl();
  ($("apiUrl") as HTMLInputElement).value = apiUrl;

  await loadEngineConfig();
}

async function handleSignIn(): Promise<void> {
  const email = ($("email") as HTMLInputElement).value.trim();
  const password = ($("password") as HTMLInputElement).value;
  if (!email || !password) {
    showStatus("authStatus", "Enter your email and password.", "error");
    return;
  }
  const btn = $("signInBtn") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Signing in…";
  clearStatus("authStatus");
  try {
    await signIn(email, password);
    showStatus("authStatus", "Signed in successfully!", "success");
    ($("password") as HTMLInputElement).value = "";
    await updateUI();
  } catch (err) {
    showStatus("authStatus", err instanceof Error ? err.message : "Sign-in failed.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

async function handleSignOut(): Promise<void> {
  await clearStoredAuth();
  await updateUI();
}

async function handleSaveApiUrl(): Promise<void> {
  const url = ($("apiUrl") as HTMLInputElement).value.trim();
  if (!url) {
    showStatus("apiStatus", "Enter a valid URL.", "error");
    return;
  }
  await setApiUrl(url);
  showStatus("apiStatus", "API URL saved.", "success");
  await loadEngineConfig();
  setTimeout(() => clearStatus("apiStatus"), 3000);
}

// Wire up event listeners
$("signInBtn").addEventListener("click", handleSignIn);
$("password").addEventListener("keydown", (e) => {
  if ((e as KeyboardEvent).key === "Enter") handleSignIn();
});
$("signOutBtn").addEventListener("click", handleSignOut);
$("saveApiUrl").addEventListener("click", handleSaveApiUrl);

updateUI();
