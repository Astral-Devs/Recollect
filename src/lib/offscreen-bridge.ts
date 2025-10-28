/**
 * Ensures that a Chrome offscreen document is active. If not, it creates one.
 * 
 * @returns A promise that resolves when the document is ready
 */
export async function ensureOffscreen(): Promise<void> {
  try {
    // @ts-ignore
    const has = await chrome.offscreen?.hasDocument?.();
    if (has) return;

    await chrome.offscreen.createDocument({
      url: "src/offscreen/index.html",
      // @ts-ignore
      reasons: [chrome.offscreen?.Reason?.BLOBS ?? "BLOBS"],
      justification: "Run local embeddings (WASM) in a DOM-like context",
    });
  } catch (e) {
    // race condition
    if (String(e).includes("Only a single offscreen document")) return;
    throw e;
  }
}

/**
 * Sends a warmup message to the offscreen to pre-load the model
 * @returns A promise that resolves when the warmup message is sent
 */
export async function warmupOffscreen(): Promise<void> {
  await ensureOffscreen();
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_WARMUP" }, () => resolve());
  });
}

/**
 * Sends text to offscreen document to be converted into a vector
 * @param text the text to be embedded
 * @returns A promise that resolves with the vector embedding or null if an error occurs
 */
export async function embedViaOffscreen(text: string): Promise<Float32Array | null> {
  await ensureOffscreen();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_EMBED", text }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("[Recollect][offscreen]", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      if (!res?.ok || !res?.vec) {
        resolve(null);
        return;
      }

      // turn res.vec into a Float32Array instead of a number array
      try {
        const out = Float32Array.from(res.vec as number[]);
        resolve(out.length ? out : null);
      } catch {
        resolve(null);
      }
    });
  });
}

