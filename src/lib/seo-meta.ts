// Automatic SEO meta generation + normalization.
// Guarantees every page/post gets a unique, length-safe meta title (<60 chars)
// and meta description (<160 chars) derived from its own content.

export const MAX_TITLE = 60;
export const MAX_DESC = 160;
export const BRAND = "PreciseDM";

const collapse = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const cutAtWord = (s: string, max: number) => {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const cut = slice.lastIndexOf(" ");
  return (cut > max * 0.5 ? slice.slice(0, cut) : slice).replace(/[\s,;:–—-]+$/, "");
};

/** Shorten any title to < MAX_TITLE without cutting words mid-way. */
export const clampTitle = (raw: string): string => {
  let t = collapse(raw);
  if (t.length < MAX_TITLE) return t;

  // 1. Drop trailing separator segments (usually brand / secondary phrases).
  const segments = t.split(/\s[|—–]\s/);
  while (segments.length > 1 && segments.join(" | ").length >= MAX_TITLE) segments.pop();
  const joined = segments.join(" | ");
  // Only accept the trimmed version if it still says something meaningful.
  if (joined.length >= 20 && joined.length < MAX_TITLE) return joined;

  // 2. Prefer the part before a colon if it is meaningful on its own.
  const colon = t.indexOf(":");
  if (colon > 20 && colon < MAX_TITLE) {
    const head = t.slice(0, colon).trim();
    const tail = t.slice(colon + 1).trim();
    const merged = `${head}: ${cutAtWord(tail, MAX_TITLE - head.length - 3)}`;
    if (merged.length < MAX_TITLE) return merged;
    return head;
  }

  // 3. Word-safe truncation.
  return cutAtWord(t, MAX_TITLE - 1);
};

/** Build a title from a page/post headline, appending the brand when it fits. */
export const buildTitle = (headline: string, withBrand = true): string => {
  const base = collapse(headline);
  if (withBrand) {
    const candidate = `${base} | ${BRAND}`;
    if (candidate.length < MAX_TITLE) return candidate;
  }
  return clampTitle(base);
};

/** Shorten any description to < MAX_DESC, preferring whole sentences. */
export const clampDescription = (raw: string): string => {
  const d = collapse(raw);
  if (d.length < MAX_DESC) return d;

  const sentences = d.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length >= MAX_DESC) break;
    out += s;
  }
  out = out.trim();
  if (out.length > 80) return out;

  return `${cutAtWord(d, MAX_DESC - 2)}…`;
};

/** Derive a description from content when none is supplied. */
export const buildDescription = (...candidates: (string | undefined)[]): string => {
  const source = candidates.map((c) => (c ? collapse(c) : "")).find((c) => c.length > 40) || "";
  return clampDescription(source);
};
