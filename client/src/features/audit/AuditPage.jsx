import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { auditApi } from '../../api/resources.js';
import { Button } from '../../components/Button.jsx';
import { Input, Select } from '../../components/Field.jsx';
import { PageHeader } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { AUDIT_ACTIONS } from '../../lib/constants.js';
import { Timeline } from './Timeline.jsx';

const ENTITY_TYPES = ['content', 'case', 'report', 'appeal', 'policy', 'reevaluationRun', 'user'];

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(params);
  // A "to" date includes the whole day.
  const apiQuery = query.to ? { ...query, to: `${query.to}T23:59:59.999` } : query;
  const audit = useQuery({
    queryKey: ['audit', apiQuery],
    queryFn: () => auditApi.list(apiQuery),
    placeholderData: (prev) => prev,
  });
  const page = Number(params.get('page') ?? 1);
  const goTo = (p) => setParams({ ...query, page: String(p) });

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Append-only"
        title="Audit log"
        description="Every business event: who did what to which item, under which policy version. Events are never edited or deleted."
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="label">Action</span>
          <Select value={params.get('action') ?? ''} onChange={(e) => set('action', e.target.value)}>
            <option value="">All</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Entity</span>
          <Select value={params.get('entityType') ?? ''} onChange={(e) => set('entityType', e.target.value)}>
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">From</span>
          <Input type="date" value={params.get('from') ?? ''} onChange={(e) => set('from', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">To</span>
          <Input type="date" value={params.get('to') ?? ''} onChange={(e) => set('to', e.target.value)} />
        </label>
      </div>
      <section className="card p-5">
        <QueryState
          query={audit}
          isEmpty={(d) => d.items.length === 0}
          empty={{ title: 'No events match these filters.', children: 'Clear a filter to see more.' }}
        >
          {(data) => (
            <>
              <Timeline events={data.items} />
              {data.total > data.limit && (
                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <span className="font-mono text-[11px] text-subtle">
                    {data.total} events · page {page}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                      Newer
                    </Button>
                    <Button
                      size="sm"
                      disabled={page * data.limit >= data.total}
                      onClick={() => goTo(page + 1)}
                    >
                      Older
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
