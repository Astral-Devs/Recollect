export type Settings = {
  excluded: string[]; 
  backfillDays: number;  
};

export const DEFAULT_SETTINGS: Settings = {
  excluded: [
    "mail.google.", "accounts.google.", "calendar.google.",
    "paypal.com", "bank", "secure", "auth", "login"
  ],
  backfillDays: 14,
};

/**
 * Retrieves user settings from local storage
 * @returns A promise that resovles with the user settings
 */
export async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get(["settings"]);
  return { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
}

/**
 * Saves user settings to local storage
 * @param s The settings object to save
 */
export async function saveSettings(s: Settings) {
  await chrome.storage.local.set({ settings: s });
}

/**
 * Compiles an array of string patterns into regular expressions
 * @param patterns the string patterns
 * @returns An array of RegExp objexts.
 */
export function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map((p) => {
    try { return new RegExp(p, "i"); } catch { return new RegExp(escapeRegex(p), "i"); }
  });
}
/**
 * Escapes special characters in a string to. use in a regular expression
 * @param s string to escape
 * @returns the escaped string
 */
function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/**
 * Converts a timestamp into a human readable string (i.e 1h ago)
 * @param ts the timestamp in ms
 * @returns Formatted time string
 */
export function timeAgo(ts: number): string {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  const units: [number, string][] = [
    [60, "s"], [60, "m"], [24, "h"], [7, "d"], [4.348, "w"], [12, "mo"], [Number.MAX_SAFE_INTEGER, "y"]
  ];
  let val = sec, i = 0;
  for (; i < units.length - 1 && val >= units[i][0]; i++) val = Math.floor(val / units[i][0]);
  return `${val}${units[i][1]} ago`;
}

/**
 * Creates a cannonical version of a URL by removing the hash and sorting search parameters
 * @param u URL string
 * @returns cannonical URL string
 */
export function canonicalUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = ""; url.searchParams.sort();
    return url.toString();
  } catch { return u; }
}
