import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { policiesApi } from '../../api/resources.js';
import { Badge, SeverityBadge } from '../../components/Badge.jsx';
import { PageHeader, Section } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { ROLES } from '../../lib/constants.js';
import { dateTime } from '../../lib/format.js';
import { useSession } from '../auth/session.js';
import { PublishPolicy } from './PublishPolicy.jsx';

const STATUS_TONE = { active: 'ok', retired: 'neutral', draft: 'caution' };
const CHANGE_TONE = { added: 'ok', removed: 'danger', changed: 'caution', unchanged: 'neutral' };

function Clause({ clause }) {
  return (
    <li className="flex flex-col gap-2 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{clause.code}</Badge>
        <span className="text-sm text-fg">{clause.title}</span>
        <SeverityBadge severity={clause.defaultSeverity} />
        {clause.deterministic?.alwaysEscalate && <Badge tone="warn">Always escalate</Badge>}
      </div>
      <p className="text-sm text-muted">{clause.text}</p>
      <p className="font-mono text-[11px] text-subtle">Allowed: {clause.allowedActions.join(' · ')}</p>
    </li>
  );
}

function Diff({ from, to }) {
  const diff = useQuery({ queryKey: ['policy-diff', from, to], queryFn: () => policiesApi.diff(from, to) });
  return (
    <Section title={`What changed · v${from} → v${to}`}>
      <QueryState query={diff}>
        {(data) => (
          <ul className="divide-y divide-line">
            <li className="px-5 py-3 text-sm text-muted">{data.changelog}</li>
            {data.clauses
              .filter((c) => c.change !== 'unchanged')
              .map((c) => (
                <li key={c.code} className="flex flex-col gap-2 px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{c.code}</Badge>
                    <Badge tone={CHANGE_TONE[c.change]}>{c.change}</Badge>
                    {c.fields.map((f) => (
                      <span key={f} className="font-mono text-[11px] text-subtle">
                        {f}
                      </span>
                    ))}
                  </div>
                  {c.before && c.change !== 'added' && c.fields.includes('text') && (
                    <p className="border-l border-danger/50 pl-3 text-muted line-through decoration-danger/40">
                      {c.before.text}
                    </p>
                  )}
                  {c.after && (c.change === 'added' || c.fields.includes('text')) && (
                    <p className="border-l border-ok/50 pl-3 text-fg">{c.after.text}</p>
                  )}
                  {c.fields.includes('deterministic') && (
                    <p className="font-mono text-[11px] text-subtle">
                      Rules: {JSON.stringify(c.before?.deterministic)} →{' '}
                      {JSON.stringify(c.after?.deterministic)}
                    </p>
                  )}
                </li>
              ))}
            <li className="px-5 py-3 font-mono text-[11px] text-subtle">
              Unchanged:{' '}
              {data.clauses
                .filter((c) => c.change === 'unchanged')
                .map((c) => c.code)
                .join(', ') || 'none'}
            </li>
          </ul>
        )}
      </QueryState>
    </Section>
  );
}

function PolicyBody({ policies }) {
  const [params, setParams] = useSearchParams();
  const active = policies.find((p) => p.status === 'active') ?? policies[0];
  const selected = policies.find((p) => p.version === Number(params.get('v'))) ?? active;
  const latest = policies[0].version;
  const diffFrom = Number(params.get('from')) || latest - 1;
  const diffTo = Number(params.get('to')) || latest;

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Policy versions" className="flex flex-row gap-2 overflow-x-auto lg:flex-col">
        {policies.map((p) => (
          <button
            key={p.version}
            type="button"
            onClick={() => setParams({ v: String(p.version) })}
            className={`card min-w-40 px-4 py-3 text-left transition-colors duration-150 ${
              p.version === selected.version ? 'border-accent/50!' : 'card-hover'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-2xl">v{p.version}</span>
              <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
            </div>
            <p className="mt-1 font-mono text-[10.5px] text-subtle">
              {p.publishedAt ? dateTime(p.publishedAt) : 'Not published'}
            </p>
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-4">
        <Section
          title={`Clauses · v${selected.version}`}
          aside={<span className="font-mono text-[11px] text-subtle">{selected.clauses.length} clauses</span>}
        >
          <p className="border-b border-line px-5 py-3 text-sm text-muted">{selected.changelog}</p>
          <ul className="divide-y divide-line">
            {selected.clauses.map((c) => (
              <Clause key={c.code} clause={c} />
            ))}
          </ul>
        </Section>
        {policies.length > 1 && diffFrom >= 1 && <Diff from={diffFrom} to={diffTo} />}
      </div>
    </div>
  );
}

export function PolicyPage() {
  const { data: me } = useSession();
  const policies = useQuery({ queryKey: ['policies'], queryFn: policiesApi.list });
  return (
    <div>
      <PageHeader
        eyebrow="Rulebook"
        title="Policy"
        description="The policy is data, not prompt text. Every analysis and decision records the version it used."
      />
      <div className="flex flex-col gap-4">
        {me.role === ROLES.ADMIN && <PublishPolicy />}
        <QueryState
          query={policies}
          isEmpty={(d) => d.items.length === 0}
          empty={{ title: 'No policy yet.', children: 'Run the seed script to load v1.' }}
        >
          {(data) => <PolicyBody policies={data.items} />}
        </QueryState>
      </div>
    </div>
  );
}
