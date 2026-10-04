import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { casesApi } from '../../api/resources.js';
import { ActionBadge, Badge, SeverityBadge, StatusBadge, VersionBadge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { Select } from '../../components/Field.jsx';
import { PageHeader } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { CASE_STATUS, TRIGGERS } from '../../lib/constants.js';
import { humanize, percent, timeAgo } from '../../lib/format.js';

const FILTERS = [
  {
    key: 'status',
    label: 'Status',
    options: Object.values(CASE_STATUS),
    fallback: CASE_STATUS.AWAITING_REVIEW,
  },
  { key: 'priority', label: 'Priority', options: ['high', 'medium', 'low'] },
  { key: 'trigger', label: 'Trigger', options: TRIGGERS },
  { key: 'policyVersion', label: 'Policy', options: ['1', '2', '3'], format: (v) => `v${v}` },
];

function PriorityBar({ value }) {
  const tone = value >= 70 ? 'bg-danger' : value >= 40 ? 'bg-caution' : 'bg-subtle';
  return (
    <div className="flex items-center gap-2" title={`Priority ${value}`}>
      <div className="h-1 w-10 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[11px] text-muted">{value}</span>
    </div>
  );
}

function Filters({ params, setParams }) {
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {FILTERS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 sm:w-44">
          <span className="label">{f.label}</span>
          <Select value={params.get(f.key) ?? f.fallback ?? ''} onChange={(e) => set(f.key, e.target.value)}>
            {!f.fallback && <option value="">All</option>}
            {f.options.map((o) => (
              <option key={o} value={o}>
                {f.format ? f.format(o) : humanize(o)}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );
}

const TH =
  'px-4 py-2.5 text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.08em] text-subtle whitespace-nowrap';
const TD = 'px-4 py-3 align-top';

function QueueTable({ items, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="border-b border-line">
          <tr>
            <th className={TH}>Priority</th>
            <th className={TH}>Content</th>
            <th className={TH}>Trigger</th>
            <th className={TH}>Proposed</th>
            <th className={TH}>Severity</th>
            <th className={TH}>Confidence</th>
            <th className={TH}>Why a human</th>
            <th className={TH}>Policy</th>
            <th className={TH}>Age</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr
              key={row._id}
              tabIndex={0}
              onClick={() => onOpen(row._id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(row._id)}
              className="cursor-pointer border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-white/[0.025] focus-visible:bg-white/[0.04]"
            >
              <td className={TD}>
                <PriorityBar value={row.priority} />
              </td>
              <td className={`${TD} max-w-xs`}>
                <p className="line-clamp-2 text-fg">{row.content?.excerpt}</p>
                <div className="mt-1.5 flex gap-1.5">
                  <Badge>{row.content?.type}</Badge>
                  {row.status !== CASE_STATUS.AWAITING_REVIEW && <StatusBadge status={row.status} />}
                  {row.reportCount > 0 && (
                    <Badge tone="warn">
                      {row.reportCount} report{row.reportCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {row.aiUnavailable && <Badge tone="danger">AI unavailable</Badge>}
                </div>
              </td>
              <td className={`${TD} whitespace-nowrap text-muted`}>{humanize(row.trigger)}</td>
              <td className={TD}>
                <ActionBadge action={row.proposedAction} />
              </td>
              <td className={TD}>
                <SeverityBadge severity={row.severity} />
              </td>
              <td className={`${TD} font-mono text-[12px] text-muted`}>{percent(row.confidence)}</td>
              <td className={`${TD} max-w-[240px] text-xs text-muted`}>
                <p className="line-clamp-2">{row.needsHumanReasons[0] ?? '—'}</p>
                {row.needsHumanReasons.length > 1 && (
                  <p className="mt-0.5 text-subtle">+{row.needsHumanReasons.length - 1} more</p>
                )}
              </td>
              <td className={TD}>
                <VersionBadge version={row.policyVersion} />
                {row.policyChangedFrom && (
                  <p className="mt-1 font-mono text-[10px] text-subtle">was v{row.policyChangedFrom}</p>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap font-mono text-[11px] text-subtle`}>
                {timeAgo(row.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QueuePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page') ?? 1);
  const query = Object.fromEntries(params);
  const queue = useQuery({
    queryKey: ['queue', query],
    queryFn: () => casesApi.queue(query),
    placeholderData: (prev) => prev,
  });
  const goTo = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Moderation"
        title="Queue"
        description="Sorted by priority, then oldest first. Every item here needs a human decision."
      />
      <Filters params={params} setParams={setParams} />
      <section className="card overflow-hidden">
        <QueryState
          query={queue}
          isEmpty={(d) => d.items.length === 0}
          empty={{ title: 'Queue is clear.', children: 'New reports and flagged posts will appear here.' }}
        >
          {(data) => (
            <>
              <QueueTable items={data.items} onOpen={(id) => navigate(`/cases/${id}`)} />
              {data.total > data.limit && (
                <div className="flex items-center justify-between border-t border-line px-4 py-3">
                  <span className="font-mono text-[11px] text-subtle">
                    {data.total} cases · page {page} of {Math.ceil(data.total / data.limit)}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      disabled={page * data.limit >= data.total}
                      onClick={() => goTo(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </QueryState>
      </section>
    </div>
  );
}
