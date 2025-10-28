export type QueryFilters = { site?: string; afterTs?: number; beforeTs?: number; text: string; };

/**
 * Parse a search query string to the filters
 * @param q A raw string query
 * @returns An object with parsed filters
 */
export function parseQuery(q: string): QueryFilters {
  let text = q.trim();
  const f: QueryFilters = { text: "" };

  text = text.replace(/\bsite:([^\s]+)/gi, (_m, g1) => { f.site = g1.toLowerCase(); return ""; });
  text = text.replace(/\bbefore:(\d{4}-\d{2}-\d{2})/gi, (_m, g1) => { f.beforeTs = toTs(g1, true);  return ""; });
  text = text.replace(/\bafter:(\d{4}-\d{2}-\d{2})/gi,  (_m, g1) => { f.afterTs  = toTs(g1, false); return ""; });

  f.text = text.trim();
  return f;
}

/**
 * Convert a datae string to a unix timestamp
 * @param ymd date string
 * @param end if end is true set the time to the end of the day
 * @returns unix milisecond timestamp
 */
function toTs(ymd: string, end: boolean): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (end) dt.setHours(23,59,59,999);
  return dt.getTime();
}
