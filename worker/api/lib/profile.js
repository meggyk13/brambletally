// Profile-editor helpers: social-link platforms + interest-tag normalisation.
// Shared by the profile GET bundle, PUT /api/profile/links, and
// PUT /api/interests. The client mirrors the platform list and the slug rules.

// ── Social links ───────────────────────────────────────────────────────────

export const LINK_PLATFORMS = [
  'website', 'instagram', 'bluesky', 'mastodon',
  'github', 'etsy', 'ravelry', 'youtube', 'other',
];
export const MAX_LINKS = 8;

// Accept only an https URL, <= 2000 chars. `new URL()` throws on junk and on
// scheme-relative ("//x"); the protocol check rejects http/javascript:/data:.
// Returns the normalised href, or null.
export function httpsUrlOrNull(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 2000) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  return u.href;
}

// [{ platform, value }] in, cleaned + capped list out. Unknown platforms fold
// to 'other'; non-https values drop the row. sort_order is the array index.
export function normalizeLinks(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const value = httpsUrlOrNull(raw.value);
    if (!value) continue;
    const platform = LINK_PLATFORMS.includes(raw.platform) ? raw.platform : 'other';
    out.push({ platform, value, sort_order: out.length });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

// ── Interest tags ──────────────────────────────────────────────────────────

export const MAX_INTERESTS = 15;
export const MAX_INTEREST_LABEL = 30;

// "Naalbinding & Sprang!" -> "naalbinding-sprang". Lowercase, fold diacritics
// (NFKD splits an accented letter into base + U+0300..U+036F combining mark,
// which the range strip then removes), non-alphanumerics to hyphens, collapse
// and trim hyphens, cap length.
export function slugify(label) {
  if (typeof label !== 'string') return '';
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

// Array of free-text labels in -> deduped [{ slug, label }] out, capped at
// MAX_INTERESTS. Label is trimmed to MAX_INTEREST_LABEL; a label that slugs to
// nothing (e.g. only punctuation) is dropped.
export function normalizeInterestLabels(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const label = raw.trim().slice(0, MAX_INTEREST_LABEL);
    const slug = slugify(label);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label });
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}
