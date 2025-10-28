type Settings = { excluded: string[]; backfillDays: number };

const DEFAULT_SETTINGS: Settings = {
  excluded: [
    "mail.google.", "accounts.google.", "calendar.google.",
    "paypal.com", "bank", "secure", "auth", "login"
  ],
  backfillDays: 14,
};

async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get(["settings"]);
  return { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
}
function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map((p) => {
    try { return new RegExp(p, "i"); }
    catch { return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
  });
}

function extractText(): string {
  const root = document.querySelector("article, main, body");
  if (!root) return "";
  return (root as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 20000);
}

let excludedRes: RegExp[] = [];
let timer: number | undefined;

async function refreshSettings() {
  const s = await getSettings();
  excludedRes = compilePatterns(s.excluded);
}
function isExcluded(): boolean {
  const href = location.href;
  const host = location.hostname;
  return excludedRes.some((re) => re.test(host) || re.test(href));
}

function send() {
  if (isExcluded()) return;
  const payload = {
    url: location.href,
    title: document.title,
    site: location.hostname,
    ts: Date.now(),
    text: extractText(),
  };
  chrome.runtime.sendMessage({ type: "PAGE_CONTENT", payload }).catch(() => {});
}
function scheduleSend(delay = 1500) {
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(send, delay);
}

refreshSettings().then(() => {
  scheduleSend();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleSend(); });
  window.addEventListener("popstate", () => scheduleSend());
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) refreshSettings();
});
