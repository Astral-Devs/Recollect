import { useEffect, useMemo, useState } from "react";
type Settings = { excluded: string[]; backfillDays: number };

export default function OptionsApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<{ docsCount: number; vecsCount: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (s: Settings) => setSettings(s));
    chrome.runtime.sendMessage({ type: "STATS" }, (st: any) => setStats(st));
  }, []);

  const excludedText = useMemo(
    () => (settings ? settings.excluded.join("\n") : ""),
    [settings]
  );

  const onSave = async () => {
    if (!settings) return;
    setBusy(true);
    await new Promise<void>((resolve) =>
      chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, () => resolve())
    );
    const days = settings.backfillDays; 
    chrome.runtime.sendMessage(
    { type: "BACKFILL", days, embed: true },  
    (res) => {
      if (chrome.runtime.lastError) {
        console.error("Backfill error:", chrome.runtime.lastError.message);
        return;
      }
      console.log("[Options] Backfill+Embed:", res); 
    }
  );
    setBusy(false);
  };

  const onClear = async () => {
    if (!confirm("Clear all Recollect data? This cannot be undone.")) return;
    setBusy(true);
    await new Promise<void>((resolve) =>
      chrome.runtime.sendMessage({ type: "CLEAR_DATA" }, () => resolve())
    );
    chrome.runtime.sendMessage({ type: "STATS" }, (st: any) => setStats(st));
    setBusy(false);
  };

  const onBackfill = async () => {
    if (!settings) return;
    setBusy(true);
    await new Promise<void>((resolve) =>
      chrome.runtime.sendMessage({ type: "BACKFILL", days: settings.backfillDays }, () => resolve())
    );
    chrome.runtime.sendMessage({ type: "STATS" }, (st: any) => setStats(st));
    setBusy(false);
  };

  if (!settings) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Recollect Options</h1>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Excluded domains/regex (one per line)
        </label>
        <textarea
          value={excludedText}
          onChange={(e) =>
            setSettings({ ...settings, excluded: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) })
          }
          rows={8}
          style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 8, fontFamily: "monospace" }}
        />
        <p style={{ color: "#666", marginTop: 6 }}>
          Examples: <code>mail.google.</code>, <code>bank</code>, <code>auth</code>, <code>login</code>
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Backfill window</label>
        <select
          value={settings.backfillDays}
          onChange={(e) => setSettings({ ...settings, backfillDays: Number(e.target.value) })}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
        <button onClick={onBackfill} disabled={busy} style={{ marginLeft: 10, padding: "8px 12px" }}>
          Backfill Now
        </button>
      </section>

      <section style={{ marginBottom: 16 }}>
        <button onClick={onSave} disabled={busy} style={{ padding: "8px 12px", marginRight: 10 }}>Save</button>
        <button onClick={onClear} disabled={busy} style={{ padding: "8px 12px" }}>Clear Data</button>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>Stats</h2>
        <div style={{ color: "#333" }}>
          Docs: <b>{stats?.docsCount ?? 0}</b> | Embeddings: <b>{stats?.vecsCount ?? 0}</b>
        </div>
      </section>
    </div>
  );
}
