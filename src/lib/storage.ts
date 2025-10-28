import { openDB } from "idb";
import { canonicalUrl } from "./util";
import type {IDBPDatabase} from "idb";

export type Doc = {
  id?: number;
  url: string;
  title: string;
  site: string;
  ts: number;
  excerpt?: string;
  dim?: number;
  canon?: string;
};


export type DocWithVec = Doc & { vec?: Float32Array };


let dbp: Promise<IDBPDatabase>;

/**
 * Initialize IndexedDB database
 */
export function initDB() {
  dbp = openDB('recollect', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('docs')) {
        const docs = db.createObjectStore('docs', { keyPath: 'id', autoIncrement: true });
        docs.createIndex('by_ts', 'ts');
        docs.createIndex('by_canon', 'canon');
      }
      if (!db.objectStoreNames.contains('vecs')) {
        db.createObjectStore('vecs'); 
      }
    },
  });
}

// Initialize on load
initDB();

/**
 * Saves a vector in the vector storage by creating a deep copy
 * @param id The id of the document
 * @param v the vector data
 */
export async function putVec(id: number, v: Float32Array | number[] | ArrayBuffer) {
  let f32: Float32Array;
  if (v instanceof Float32Array) {
    f32 = v;
  } else if (Array.isArray(v)) {
    f32 = Float32Array.from(v);
  } else {
    f32 = new Float32Array(v);
  }

  // Deep copy to detach from WASM/shared memory
  const copy = new Float32Array(f32.length);
  copy.set(f32);

  const db = await dbp;
  const tx = db.transaction('vecs', 'readwrite');
  await tx.store.put(copy.buffer, id);
  await tx.done;

  // console.log('[Recollect][putVec] id=', id, 'len=', copy.length, 'bytes=', copy.byteLength);
}

/**
 * Gets the total number of vectors in the storage
 * @returns A promise that resolves with the number of vectors
 */
export async function getVecCount(): Promise<number> {
  const db = await dbp;
  const tx = db.transaction('vecs', 'readonly');
  const n = await tx.store.count();
  await tx.done;
  return n;
}


/**
 * Fetches candaidate documents and their associated filter criteria
 * @param opts The filter options
 * @returns A promise that resovles to tan array of documents with vectors
 */
export async function getCandidatesWithVecs(opts: {
  site?: string;
  afterTs?: number;
  beforeTs?: number;
  limit?: number;
}): Promise<DocWithVec[]> {
  const db = await dbp;
  const tx = db.transaction(["docs", "vecs"]);
  const idx = tx.objectStore("docs").index("by_ts");
  const out: DocWithVec[] = [];
  let cur = await idx.openCursor(null, "prev");

  while (cur && out.length < (opts.limit ?? 5000)) {
    const d = cur.value as Doc;
    const okSite  = !opts.site    || d.site.toLowerCase().includes(opts.site.toLowerCase());
    const okAfter = !opts.afterTs || d.ts >= opts.afterTs;
    const okBefore= !opts.beforeTs|| d.ts <= opts.beforeTs;
    if (okSite && okAfter && okBefore) {
      const buf = await tx.objectStore("vecs").get(d.id!);
      out.push({ ...d, vec: buf ? new Float32Array(buf as ArrayBuffer) : undefined });
    }
    cur = await cur.continue();
  }
  await tx.done;
  return out;
}

/**
 * Adds a new document to the docs storage
 * @param doc The document to save
 * @param vec The optional vector array buffer to save
 * @returns A promise that resolves with the new document's ID or null if not
 */
export async function putDoc(doc: Doc, vec?: ArrayBuffer): Promise<IDBValidKey | null> {
  const db = await dbp;
  const canon = canonicalUrl(doc.url);

  const idx = db.transaction("docs").store.index("by_canon");
  let exists = false;
  for await (const cursor of idx.iterate(canon)) {
    const d = cursor.value as Doc;
    if (Math.abs(d.ts - doc.ts) < 3 * 24 * 3600 * 1000) { exists = true; break; }
  }
  if (exists) return null;

  const id = await db.add("docs", { ...doc, canon });
  if (vec) await db.put("vecs", vec, id);
  return id;
}

/**
 * Fetches the most recent documents from the database
 * @param limit The maximum number of documents to return
 * @returns A promise that resolves to an array of recent documents
 */
export async function getRecentDocs(limit = 50) {
  const db = await dbp;
  const tx = db.transaction("docs");
  const idx = tx.store.index("by_ts");
  const results: Doc[] = [];
  let cursor = await idx.openCursor(null, "prev");
  while (cursor && results.length < limit) {
    results.push(cursor.value as Doc);
    cursor = await cursor.continue();
  }
  await tx.done;
  return results;
}

/**
 * Clears all data from docs and vecs storage
 */
export async function clearAll() {
  // safer than deleteDatabase inside SW lifecycle: just wipe stores
  const db = await dbp;
  const tx = db.transaction(["docs", "vecs"], "readwrite");
  await tx.objectStore("docs").clear();
  await tx.objectStore("vecs").clear();
  await tx.done;
}

/**
 * Counts of the number of vectors and documents stored
 * @returns A promise thaat resolves to the counts
 */
export async function stats() {
  const db = await dbp;
  const tx = db.transaction(["docs", "vecs"]);
  const docsCount = await tx.objectStore("docs").count();
  const vecsCount = await tx.objectStore("vecs").count();
  return { docsCount, vecsCount };
}
