// Credit for SD for helping me figure out how to get the model loaded and 
// run entirely locally 
import { pipeline, env } from "@xenova/transformers";

// Strict offline
env.allowRemoteModels = false;
env.useBrowserCache = false;

const MODELS_BASE = chrome.runtime.getURL("models");
const WASM_BASE   = chrome.runtime.getURL("wasm");

(env as any).localModelPath = MODELS_BASE;

// ONNX Runtime Web config: conservative for MV3
const backends: any = ((env as any).backends ?? ((env as any).backends = {}));
const onnx: any     = (backends.onnx ?? (backends.onnx = {}));
const wasm: any     = (onnx.wasm ?? (onnx.wasm = {}));

wasm.proxy = false;
wasm.numThreads = 1;
(wasm as any).simd = false;

// Force all names to the non‑SIMD binary (avoids backend mismatch issues)
const nonSimd = `${WASM_BASE}/ort-wasm.wasm`;
wasm.wasmPaths = {
  "ort-wasm.wasm":               nonSimd,
  "ort-wasm-simd.wasm":          nonSimd,
  "ort-wasm-threaded.wasm":      nonSimd,
  "ort-wasm-simd-threaded.wasm": nonSimd,
};

// // For debugging
// let logged = false;
// const origFetch = globalThis.fetch;
// (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
//   const url = typeof input === "string" ? input : (input as URL).toString();
//   if (!logged && url.includes("/models/")) {
//     logged = true;
//     console.log("[Recollect][model fetch]", url);
//     const r = await origFetch(input, init);
//     if (r.ok) {
//       try {
//         const buf = await r.clone().arrayBuffer();
//         console.log("[Recollect][model bytes MB]", (buf.byteLength / (1024 * 1024)).toFixed(1));
//         const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, 64)));
//         if (head.includes("git-lfs.github.com/spec/v1")) {
//           console.error("[Recollect] ERROR: model is a Git LFS pointer file, not real ONNX");
//         }
//         if (head.startsWith("<!DOCTYPE") || head.startsWith("<html")) {
//           console.error("[Recollect] ERROR: model is HTML (bad download/redirect)");
//         }
//       } catch {}
//     }
//     return r;
//   }
//   return origFetch(input, init);
// };

// Pick a model, used a small model to fit the extension
const MODEL_ID = "Xenova/bge-small-en-v1.5"; 

let pipePromise: Promise<any> | null = null;

/**
 * Ensure the model is loaded into memory only once 
 * 
 * @returns A promise that resolves with the pipe instance
 */
async function getPipe(): Promise<any> {
  if (!pipePromise) {
    pipePromise = pipeline("feature-extraction", MODEL_ID);
  }
  return pipePromise;
}

/**
 * Generates a vector embedding for a given text string using the local model
 * @param text the text to embed
 * @returns A promise that resolves with the vector embedding or null if the text is empty or an error occurs
 */
export async function embedLocal(text: string): Promise<Float32Array | null> {
  const s = (text || "").trim().slice(0, 1000);
  if (!s) return null;

  const pipe = await getPipe();
  const out = await pipe(s, { pooling: "mean", normalize: true });

  const vec = (out?.data as Float32Array) ?? null;
  console.log("[Recollect][embedLocal] len:", vec?.length ?? 0);
  if (!vec || vec.length === 0) return null;
  return vec;
}

/**
 * Warms up the embedding model by loading it into memory
 * @returns A promise that resolves when the warmup is done
 */
export async function warmupLocal(): Promise<void> {
  try {
    await embedLocal("warmup");
  } catch (e) {
    console.warn("[Recollect][warmup] failed:", e);
  }
}
