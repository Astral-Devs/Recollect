import { useEffect, useRef, useState } from "react";
import { timeAgo } from "../lib/util";

type Doc = {
  id?: number;
  url: string;
  title: string;
  site: string;
  ts: number;
  excerpt?: string;
  score?: number;
};

function safeHost(u: string): string {
  try { return new URL(u).hostname || u; } catch { return u; }
}

export default function App() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Doc[]>([]);
  const [idx, setIdx] = useState(0);
  const tRef = useRef<number | null>(null);
  const reqIdRef = useRef(0); 

  const runSearch = (query: string) => {
    const rid = ++reqIdRef.current;
    chrome.runtime.sendMessage({ type: "SEARCH", query }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("[Recollect][SEARCH] lastError:", chrome.runtime.lastError.message);
        return;
      }
      if (rid !== reqIdRef.current) return;
      setItems((res as Doc[]) ?? []);
    });
  };

  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => runSearch(q), 200);
    return () => { if (tRef.current) window.clearTimeout(tRef.current); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter")     { const it = items[idx]; if (it) chrome.tabs.create({ url: it.url }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, idx]);

  const openOptions = () => chrome.runtime.openOptionsPage();

  return (
    <div style={{ width: 360, padding: 10, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search (site:example.com after:2025-01-01)"
        autoFocus
        style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 8, outline: "none" }}
      />

      <ul style={{ marginTop: 10, listStyle: "none", padding: 0, maxHeight: 420, overflowY: "auto" }}>
        {items.length === 0 && (
          <li style={{ color: "#666", fontSize: 13, padding: 8 }}>
            {q ? "No results yet." : "Type to search your recent pages."}
          </li>
        )}

        {items.map((d, i) => {
          const host = safeHost(d.url);
          return (
            <li
              key={(d.id ?? i) + d.url + d.ts}
              style={{
                padding: 8,
                borderRadius: 8,
                background: i === idx ? "#eef6ff" : "transparent",
                cursor: "pointer",
                display: "flex",
                gap: 8,
              }}
              onMouseEnter={() => setIdx(i)}
              onClick={() => chrome.tabs.create({ url: d.url })}
            >
              <div
                style={{
                  width: 16, height: 16, borderRadius: 3, background: "#e5e7eb",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#555", flexShrink: 0, marginTop: 2
                }}
                title={host}
              >
                {host.slice(0, 1).toUpperCase()}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.title || d.url}
                </div>
                <div style={{ color: "#666", fontSize: 12, display: "flex", gap: 6 }}>
                  <span>{host}</span>
                  <span>•</span>
                  <span>{timeAgo(d.ts)}</span>
                  {typeof d.score === "number" && <><span>•</span><span>{d.score.toFixed(2)}</span></>}
                </div>
                {d.excerpt && (
                  <div style={{ color: "#444", fontSize: 12, marginTop: 4, lineHeight: 1.2, maxHeight: 36, overflow: "hidden" }}>
                    {d.excerpt}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#888", fontSize: 12 }}>↑/↓, Enter • Ctrl/⌘K to open</span>
        <button
          onClick={openOptions}
          style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 6, background: "#fff" }}
        >
          Options
        </button>
      </div>
    </div>
  );
}
