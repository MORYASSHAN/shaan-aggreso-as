import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { appealsApi } from '../../api/resources.js';
import { ActionBadge, Badge, VersionBadge } from '../../components/Badge.jsx';
import { PageHeader } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { useSession } from '../auth/session.js';
import { timeAgo } from '../../lib/format.js';

const TABS = [
  { value: 'pending', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

export function AppealsQueuePage() {
  const { data: me } = useSession();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const query = useQuery({ queryKey: ['appeals', status], queryFn: () => appealsApi.list({ status }) });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Second review"
        title="Appeals"
        description="Appeals assigned to you and unassigned ones. You never review an appeal of your own decision."
      />
      <div className="mb-4 inline-flex rounded-lg border border-line p-0.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setParams({ status: t.value })}
            className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ${
              status === t.value ? 'bg-white/[0.07] text-fg' : 'text-subtle hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <QueryState
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={{
          title: status === 'pending' ? 'No open appeals.' : 'No resolved appeals yet.',
          children: 'Appeals assigned to you will appear here.',
        }}
      >
        {(data) => (
          <ul className="flex flex-col gap-2">
            {data.items.map((a) => (
              <li key={a._id}>
                <Link to={`/appeals/${a._id}`} className="card card-hover flex flex-col gap-2 p-4 fade-in">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.assignedReviewerId ? (
                      <Badge tone={String(a.assignedReviewerId._id) === me.id ? 'accent' : 'neutral'}>
                        {String(a.assignedReviewerId._id) === me.id
                          ? 'Assigned to you'
                          : `Assigned to ${a.assignedReviewerId.name}`}
                      </Badge>
                    ) : (
                      <Badge tone="warn">No eligible reviewer</Badge>
                    )}
                    {a.decision && <ActionBadge action={a.decision.finalAction} />}
                    {a.decision?.clauseCodes.map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                    {a.decision && <VersionBadge version={a.decision.policyVersion} />}
                    <span className="ml-auto font-mono text-[11px] text-subtle">{timeAgo(a.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">“{a.statement}”</p>
                  <p className="font-mono text-[11px] text-subtle">by {a.authorId?.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
