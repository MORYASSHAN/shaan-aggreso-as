const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

export function maskContacts(text) {
  return text.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

// Logs only ever carry a short, masked excerpt of user content.
export function logExcerpt(text, max = 60) {
  const masked = maskContacts(String(text ?? ''));
  return masked.length > max ? `${masked.slice(0, max)}…` : masked;
}

export function excerpt(text, max = 140) {
  const flat = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

// Keeps a map from each normalised character back to its original index, so a quote
// found in normalised text can be highlighted at its real position.
export function normalizeWithMap(text) {
  let normalized = '';
  const map = [];
  let inSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (inSpace || normalized.length === 0) continue;
      inSpace = true;
      normalized += ' ';
      map.push(i);
      continue;
    }
    inSpace = false;
    normalized += ch.toLowerCase();
    map.push(i);
  }
  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1);
    map.pop();
  }
  return { normalized, map };
}

export function normalize(text) {
  return normalizeWithMap(String(text ?? '')).normalized;
}

/** Returns { start, end } in the original text, or null if the quote is not really there. */
export function locateQuote(text, quote) {
  const needle = normalize(quote);
  if (!needle) return null;
  const { normalized, map } = normalizeWithMap(text);
  const at = normalized.indexOf(needle);
  if (at === -1) return null;
  return { start: map[at], end: map[at + needle.length - 1] + 1 };
}
