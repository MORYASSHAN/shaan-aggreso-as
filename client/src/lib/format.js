const UNITS = [
  ['y', 365 * 24 * 3600],
  ['mo', 30 * 24 * 3600],
  ['d', 24 * 3600],
  ['h', 3600],
  ['m', 60],
];

export function timeAgo(date) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  for (const [unit, size] of UNITS) if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
  return 'just now';
}

export function dateTime(date) {
  return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function percent(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

export function humanize(value) {
  if (!value) return '';
  const text = String(value).replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The visible verb for what a human is doing, e.g. "Approve: label content". */
export function actionPhrase(action) {
  return action === 'none' ? 'take no action' : `${action} content`;
}

export function shortId(id) {
  return String(id ?? '').slice(-6);
}
