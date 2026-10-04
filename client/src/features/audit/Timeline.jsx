import { VersionBadge } from '../../components/Badge.jsx';
import { dateTime, humanize } from '../../lib/format.js';

const ACTION_DOT = {
  'decision.made': 'bg-accent',
  'appeal.resolved': 'bg-accent',
  'content.visibility_changed': 'bg-warn',
  'auth.denied': 'bg-danger',
  'analysis.failed': 'bg-danger',
  'policy.published': 'bg-info',
  'case.auto_cleared': 'bg-ok',
};

function actorName(actor) {
  if (!actor) return 'Unknown';
  if (actor.type !== 'user') return humanize(actor.type);
  return actor.id?.name ?? 'User';
}

function detail(event) {
  const a = event.after ?? {};
  if (event.action === 'decision.made')
    return `${a.outcome} → ${a.finalAction}${a.clauseCodes?.length ? ` (${a.clauseCodes.join(', ')})` : ''}`;
  if (event.action === 'content.visibility_changed') return `${event.before?.visibility} → ${a.visibility}`;
  if (event.action === 'auth.denied') return a.reason;
  if (event.action.startsWith('analysis.'))
    return `proposed ${a.proposedAction}${a.aiStatus && a.aiStatus !== 'ok' ? ` · AI ${a.aiStatus}` : ''}`;
  if (event.action === 'report.created' && a.reasonCode) return a.reasonCode;
  if (event.action === 'case.reevaluated') return `v${event.before?.policyVersion} → v${a.policyVersion}`;
  if (event.action === 'appeal.resolved') return a.status;
  return null;
}

/** A vertical timeline: who did what, when, under which policy version. */
export function Timeline({ events }) {
  return (
    <ol className="relative flex flex-col">
      {events.map((e, i) => (
        <li key={e._id ?? i} className="relative flex gap-4 pb-5 pl-1 last:pb-0">
          <div className="flex flex-col items-center">
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-black ${ACTION_DOT[e.action] ?? 'bg-subtle'}`}
            />
            {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-fg">{e.action}</span>
              <VersionBadge version={e.policyVersion} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {actorName(e.actor)}
              {e.actor?.role ? <span className="text-subtle"> · {humanize(e.actor.role)}</span> : null}
              {detail(e) ? <span className="text-subtle"> · {detail(e)}</span> : null}
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] text-subtle">
              {dateTime(e.at)} · {e.entity?.type} {String(e.entity?.id).slice(-6)}
              {e.requestId ? ` · req ${String(e.requestId).slice(0, 8)}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
