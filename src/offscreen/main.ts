import { embedLocal, warmupLocal } from "../lib/embeddings-local";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "OFFSCREEN_WARMUP") {
        await warmupLocal();
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "OFFSCREEN_EMBED") {
        const text = String(msg.text ?? "");
        const vec = await embedLocal(text); 
        if (!vec || vec.length === 0) {
          sendResponse({ ok: false, error: "empty_vector" });
          return;
        }

        // Deep-copy to detach from WASM memory
        const copy = new Float32Array(vec.length);
        copy.set(vec);

        sendResponse({ ok: true, vec: Array.from(copy) });
        return;
      }

    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
