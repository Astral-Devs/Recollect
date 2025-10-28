import { initDB, putDoc, getRecentDocs, clearAll, stats } from "./lib/storage";
import { putVec, getVecCount } from "./lib/storage";
import { embedText } from "./lib/embeddings";
import { semanticSearch } from "./lib/search";
import { getSettings, saveSettings, compilePatterns } from "./lib/util";
import { ensureOffscreen, warmupOffscreen } from "./lib/offscreen-bridge";


initDB();
async function bootOffscreen() {
  try {
    await ensureOffscreen();
    await warmupOffscreen();
  } catch (e) {
    const msg = String(e || "");
    if (!msg.includes("Only a single offscreen document")) {
      console.warn("[Recollect] offscreen warmup failed:", e);
    }
  }
}

chrome.runtime.onInstalled.addListener(bootOffscreen);
chrome.runtime.onStartup?.addListener(bootOffscreen);

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "open-search") chrome.action.openPopup().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type && String(msg.type).startsWith("OFFSCREEN_")) {
    return false; 
  }

  let willRespond = false;

  (async () => {
    try {
      switch (msg?.type) {

        case "PAGE_CONTENT": {
          willRespond = true;

          const { url, title, site, ts, text } = (msg as any).payload ?? msg;
          if (!url || !title) {
            sendResponse({ ok: false, error: "missing_url_or_title" });
            return;
          }
          try {
            const u = new URL(url);
            if (u.protocol !== "http:" && u.protocol !== "https:") {
              sendResponse({ ok: false, skipped: true });
              return;
            }
          } catch {
            sendResponse({ ok: false, skipped: true });
            return;
          }

          const excerpt = (text || "").slice(0, 400);
          const idKey = await putDoc({ url, title, site, ts, excerpt, dim: 0 });

          if (idKey != null && typeof idKey === "number" && text) {
            const payload = `${title} • ${site} • ${text.slice(0, 1000)}`;
            embedText(payload)
              .then((vec) => vec && vec.length ? putVec(idKey, vec) : undefined)
              .catch((e) => console.warn("[Recollect][embed error]", e));
          }

          sendResponse({ ok: true, id: idKey });
          return;
        }

        case "SEARCH": {
          willRespond = true;
          const q = String((msg as any).query ?? "").trim();
          if (!q) {
            const items = await getRecentDocs(30);
            sendResponse(items);
            return;
          }
          const results = await semanticSearch(q, 20);
          sendResponse(results);
          return;
        }

        case "GET_SETTINGS": {
          willRespond = true;
          const s = await getSettings();
          sendResponse(s);
          return;
        }

        case "SAVE_SETTINGS": {
          willRespond = true;
          await saveSettings((msg as any).settings);
          sendResponse({ ok: true });
          return;
        }

        case "BACKFILL": {
          willRespond = true;
          const days = Number((msg as any).days) || (await getSettings()).backfillDays;
          const out = await backfill(days, true);
          sendResponse({ ok: true, days, ...out }); 
          return;
        }



        case "CLEAR_DATA": {
          willRespond = true;
          await clearAll();
          sendResponse({ ok: true });
          return;
        }

        case "STATS": {
          willRespond = true;
          const s = await stats();
          sendResponse({ ok: true, ...s });
          return;
        }
        // Not necessary now, as the fail case has gotten much smaller, but Ill keep it here for any future use
        // case "REEMBED_MISSING": {
        //   willRespond = true;

        //   const cap = Math.max(1, Math.min(Number((msg as any).n) || 2000, 10000));

        //   try { await ensureOffscreen(); await warmupOffscreen(); } catch {}

        //   const dbOpen = indexedDB.open('recollect', 1);
        //   const db = await new Promise<IDBDatabase>((res, rej) => { dbOpen.onsuccess=()=>res(dbOpen.result); dbOpen.onerror=()=>rej(dbOpen.error); });
        //   const txScan = db.transaction(['docs','vecs'], 'readonly');
        //   const idx = txScan.objectStore('docs').index('by_ts');

        //   const todo: any[] = [];
        //   for (let cur = await new Promise<IDBCursorWithValue|null>(r => { const rq = idx.openCursor(null, 'prev'); rq.onsuccess=()=>r(rq.result||null); });
        //       cur && todo.length < cap;
        //       cur = await new Promise<IDBCursorWithValue|null>(r => { (cur as any).continue(); (cur as any).request.onsuccess = () => r((cur as any).request.result || null); })) {
        //     const has = await new Promise<ArrayBuffer|null>(r => {
        //       const rq = txScan.objectStore('vecs').get((cur as any).value.id);
        //       rq.onsuccess = () => r(rq.result || null);
        //     });
        //     if (!has) todo.push((cur as any).value);
        //   }

        //   let saved = 0, empty = 0, errors = 0;
        //   for (const d of todo) {
        //     try {
        //       const text = `${d.title ?? ''} • ${d.site ?? ''} • ${(d.excerpt ?? '').slice(0, 1000) || d.title}`;
        //       const vec = await embedText(text);
        //       if (vec && vec.length) {
        //         await putVec(d.id as number, vec);
        //         console.log('[Recollect][reembed missing saved]', d.id, vec.length);
        //         saved++;
        //       } else {
        //         empty++;
        //         console.warn('[Recollect][reembed missing empty]', d.id);
        //       }
        //     } catch (e) {
        //       errors++;
        //       console.warn('[Recollect][reembed missing error]', d.id, e);
        //     }
        //     await new Promise(r => setTimeout(r, 0));
        //   }

        //   sendResponse({ ok: true, saved, empty, errors, scanned: todo.length });
        //   return;
        // }


        case 'REEMBED_RECENT': {
          willRespond = true;

          const n = Math.max(1, Math.min(Number((msg as any).n) || 300, 2000));
          const recent = await getRecentDocs(n);
          let done = 0, empty = 0, errors = 0;

          for (const d of recent) {
            try {
              const text = `${d.title ?? ''} • ${d.site ?? ''} • ${d.excerpt ?? ''}`.slice(0, 1000);
              const vec = await embedText(text);
              if (vec && vec.length) {
                await putVec(d.id as number, vec);
                // console.log('[Recollect][reembed saved]', d.id, vec.length);
                done++;
              } else {
                // console.warn('[Recollect][reembed empty vec]', d.id);
                empty++;
              }
            } catch (e) {
              // console.warn('[Recollect][reembed error]', d.id, e);
              errors++;
            }
            await new Promise(r => setTimeout(r, 0));
          }

          const vecs = await getVecCount();
          console.log('[Recollect][reembed] done:', { saved: done, empty, errors, vecsTotal: vecs });
          sendResponse({ ok: true, saved: done, empty, errors, vecs });
          return;
        }


        default: {
          sendResponse({ ok: false, error: "unknown_message_type" });
          return;
        }
      }
    } catch (err) {
      try { sendResponse({ ok: false, error: String(err) }); } catch {}
    }
  })();

  return willRespond;
});

async function backfill(days: number, embed: boolean) {
  const s = await getSettings();
  const excluded = compilePatterns(s.excluded);
  const end = Date.now();
  const start = end - days * 24 * 60 * 60 * 1000;

  const historyItems = await chrome.history.search({
    text: "",
    startTime: start,
    endTime: end,
    maxResults: 5000,
  });

  let inserted = 0;
  let embedded = 0;
  let skipped = 0;

  const getPageText = async (url: string): Promise<string> => {
    try {
      const r = await fetch(url, { method: "GET", credentials: "omit" });
      const ct = r.headers.get("content-type") || "";
      if (!r.ok || !ct.includes("text/html")) return "";
      const html = await r.text();
      let t = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ");
      return t.replace(/\s+/g, " ").trim().slice(0, 20000);
    } catch {
      return "";
    }
  };

  for (const h of historyItems) {
    const url = h.url;
    if (!url) { skipped++; continue; }

    let host = "";
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") { skipped++; continue; }
      host = u.hostname;
    } catch { skipped++; continue; }

    if (excluded.some((re) => re.test(host) || re.test(url))) { skipped++; continue; }

    const title = h.title || url;
    const ts = Math.floor(h.lastVisitTime || Date.now());
    const pageText = embed ? await getPageText(url) : "";
    const excerpt = (pageText || "").slice(0, 500);

    const idKey = await putDoc({ url, title, site: host, ts, excerpt, dim: 0 });
    if (idKey == null) { skipped++; continue; }
    inserted++;

    if (embed) {
      try {
        const toEmbed = `${title} • ${host} • ${(pageText || excerpt || title).slice(0, 1000)}`;
        const vec = await embedText(toEmbed);
        if (vec && vec.length) {
          await putVec(idKey as number, vec);
          embedded++;
        }
      } catch (e) {
        console.warn("[Recollect][backfill embed error]", idKey, e);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return { inserted, embedded, skipped };
}
