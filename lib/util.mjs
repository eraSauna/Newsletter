// Kleine helpers voor de funnel.

const UA = "eraSauna-Intelligence/1.0 (+https://erasauna.nl; nieuwsbrief-bot)";

/** Haal een pagina op en geef schone, ingekorte platte tekst terug. */
export async function fetchText(url, { maxChars = 6000, timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, maxChars);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

export function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simpele concurrency-limiter zodat we bronnen niet allemaal tegelijk raken. */
export async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
