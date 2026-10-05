import { useState } from 'react';
import { Badge } from '../../components/Badge.jsx';
import { timeAgo } from '../../lib/format.js';
import { ReportForm } from './ReportForm.jsx';

const VISIBILITY_NOTE = {
  labeled: { tone: 'caution', text: 'Labeled' },
  limited: { tone: 'warn', text: 'Limited' },
  removed: { tone: 'danger', text: 'Removed' },
};

// Removed items are only ever sent to moderators.
export function ContentItem({ item, viewer, children }) {
  const [reporting, setReporting] = useState(false);
  const note = VISIBILITY_NOTE[item.visibility];
  const removed = item.visibility === 'removed';
  const isOwn = String(item.authorId?._id) === viewer.id;

  return (
    <div className={removed ? 'opacity-45' : undefined}>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-fg">{item.authorId?.name ?? 'Unknown'}</span>
        <span className="text-subtle">·</span>
        <span className="font-mono text-[11px] text-subtle">{timeAgo(item.createdAt)}</span>
        {note && <Badge tone={note.tone}>{note.text}</Badge>}
      </div>
      <p
        className={`mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed ${removed ? 'line-through decoration-white/20' : ''}`}
      >
        {item.body}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {children}
        {!isOwn && !removed && (
          <button
            type="button"
            onClick={() => setReporting((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle transition-colors duration-150 hover:text-danger"
          >
            Report
          </button>
        )}
      </div>
      {reporting && <ReportForm contentId={item._id} onClose={() => setReporting(false)} />}
    </div>
  );
}
