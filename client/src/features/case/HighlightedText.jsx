/** Merges overlapping [start, end) ranges so each character is highlighted at most once. */
export function mergeRanges(ranges) {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of sorted) {
    const last = merged.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

export function HighlightedText({ text, ranges }) {
  const parts = [];
  let at = 0;
  for (const { start, end } of mergeRanges(ranges)) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark
        key={start}
        className="rounded-[3px] bg-accent/20 px-0.5 text-fg shadow-[inset_0_-1px_0_rgb(177_159_255/0.7)]"
      >
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{parts}</p>;
}
