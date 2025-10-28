import { getCandidatesWithVecs } from "./storage";
import type { DocWithVec } from "./storage";
import { parseQuery } from "./parse";
import { embedQuery } from "./embeddings";

/**
 * Calculates a recency boost score for a document. 
 * @param ts The timestamp of the document in millliseconds
 * @returns The recency boost score, between 0 and 1
 */
function recencyBoost(ts: number): number {
  const days = Math.max(0, (Date.now() - ts) / (24 * 3600 * 1000));
  return Math.exp(-days / 21); 
}

/**
 * Calculates the dot product of two vectors
 * @param a The first vector
 * @param b The second vector
 * @returns The dot product
 */
function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Performs a semantic search over the stored documents
 * @param q the search query
 * @param topK the number of top results to return
 * @returns A promise that resolves to an array of the top K searches
 */
export async function semanticSearch(q: string, topK = 20): Promise<any[]> {
  const { site, beforeTs, afterTs, text } = parseQuery(q);
  const qvec = await embedQuery(text || q);

  const cands = await getCandidatesWithVecs({ site, beforeTs, afterTs, limit: 5000 });
  const withVec = cands.filter(c => !!c.vec);

  // fallback
  if (!qvec || withVec.length === 0) {
    return cands.slice(0, topK).map(c => toResult(c, 0));
  }

  const alpha = 0.85, beta = 0.15;
  const results: { score: number; doc: DocWithVec }[] = [];

  const BATCH = 2000;
  for (let i = 0; i < cands.length; i += BATCH) {
    const chunk = cands.slice(i, i + BATCH);
    for (const d of chunk) {
      if (!d.vec) continue;
      const cos = Math.max(0, dot(qvec, d.vec)); 
      const s = alpha * cos + beta * recencyBoost(d.ts);
      results.push({ score: s, doc: d });
    }
    await Promise.resolve();
  }

  // dedupe by URL 
  const bestByUrl = new Map<string, { score: number; doc: DocWithVec }>();
  for (const r of results) {
    const key = stripHash(r.doc.url);
    const prev = bestByUrl.get(key);
    if (!prev || r.score > prev.score) bestByUrl.set(key, r);
  }

  return [...bestByUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(r => toResult(r.doc, r.score));
}

/**
 * Removes hash fragments from URL string
 * @param u the URL string
 * @returns The URL without hash
 */
function stripHash(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return u.split("#")[0];
  }
}

/**
 * 
 * @param d The document with vector
 * @param score calculated search score
 * @returns A strucutred result
 */
function toResult(d: DocWithVec, score: number) {
  return {
    id: d.id,
    url: d.url,
    title: d.title,
    site: d.site,
    ts: d.ts,
    excerpt: d.excerpt,
    score,
  };
}
