import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { contentApi } from '../../api/resources.js';
import { Badge, StatusBadge, VersionBadge, VisibilityBadge } from '../../components/Badge.jsx';
import { PageHeader, Section } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { CASE_STATUS, OVERSIGHT_ROLES } from '../../lib/constants.js';
import { dateTime, humanize, shortId } from '../../lib/format.js';
import { DecisionSummary } from '../appeals/DecisionSummary.jsx';
import { useSession } from '../auth/session.js';
import { Findings } from '../case/Findings.jsx';
import { RecommendationCard } from '../case/RecommendationCard.jsx';
import { Timeline } from './Timeline.jsx';

function Notice({ tone = 'accent', children }) {
  const styles =
    tone === 'danger' ? 'border-danger/35 bg-danger/[0.06]' : 'border-accent/35 bg-accent/[0.06]';
  return <div className={`rounded-lg border px-4 py-3 text-sm fade-in ${styles}`}>{children}</div>;
}

// What the author is told before a human has decided. AI findings are never shown to them.
function authorStatus(kase, latest, type) {
  switch (kase.status) {
    case CASE_STATUS.PENDING_ANALYSIS:
      return `Your ${type} is being checked against the policy.`;
    case CASE_STATUS.AWAITING_REVIEW:
      return `A moderator will review this ${type}. Nothing changes on your ${type} until they decide.`;
    case CASE_STATUS.AUTO_CLEARED:
      return `Checked against policy v${latest?.policyVersion}: no issues found.`;
    default:
      return null;
  }
}

function AiReview({ analysis }) {
  const failure = analysis.ai?.failure;
  return (
    <div className="flex flex-col gap-4">
      {failure ? (
        <Notice tone="danger">
          <span className="font-medium text-fg">AI review unavailable.</span> {failure} The rule findings
          below still apply, and a moderator must decide.
        </Notice>
      ) : (
        analysis.ai && (
          <p className="font-mono text-[11px] text-subtle">
            Reviewed by {analysis.ai.model}
            {analysis.ai.latencyMs ? ` in ${(analysis.ai.latencyMs / 1000).toFixed(1)} s` : ''}
          </p>
        )
      )}
      <RecommendationCard analysis={analysis} aiUnavailable={Boolean(failure)} />
      <Findings analysis={analysis} />
    </div>
  );
}

function AppealBlock({ appeal, outcome }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line p-4 text-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="label">Appeal</span>
          <Badge tone={appeal.status === 'pending' ? 'warn' : 'neutral'}>{appeal.status}</Badge>
        </div>
        <p className="whitespace-pre-wrap text-fg">“{appeal.statement}”</p>
        {appeal.evidence && (
          <>
            <p className="label mb-1 mt-3">Evidence</p>
            <p className="whitespace-pre-wrap text-muted">{appeal.evidence}</p>
          </>
        )}
        <p className="mt-3 font-mono text-[11px] text-subtle">Submitted {dateTime(appeal.createdAt)}</p>
      </div>
      <div className="rounded-lg border border-line p-4 text-sm">
        <p className="label mb-2">Final outcome</p>
        {outcome ? (
          <div className="flex flex-col gap-2">
            <Badge tone="neutral">{outcome.outcome}</Badge>
            <DecisionSummary decision={outcome} />
          </div>
        ) : (
          <p className="text-subtle">Waiting for a second review by a senior moderator.</p>
        )}
      </div>
    </div>
  );
}

function CaseHistory({ kase, data, staff }) {
  const analyses = data.analyses.filter((a) => a.caseId === kase._id);
  const latest = analyses.at(-1);
  const decisions = data.decisions.filter((d) => d.caseId === kase._id);
  const original = decisions.find((d) => d.stage === 'initial');
  const appeal = data.appeals.find((a) => a.caseId === kase._id);
  const outcome = decisions.find((d) => d.stage === 'appeal');
  const status = !staff && authorStatus(kase, latest, data.content.type);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label">
          Case {shortId(kase._id)} · {humanize(kase.trigger)}
        </span>
        <StatusBadge status={kase.status} />
        {latest && <VersionBadge version={latest.policyVersion} />}
        {staff && (
          <Link
            to={`/cases/${kase._id}`}
            className="label ml-auto underline decoration-accent/50 underline-offset-4 hover:text-accent"
          >
            Open case
          </Link>
        )}
      </div>

      {status && <Notice>{status}</Notice>}
      {staff && latest?.recommendation && <AiReview analysis={latest} />}
      {staff && analyses.length > 1 && (
        <p className="text-xs text-subtle">
          {analyses.length - 1} earlier {analyses.length === 2 ? 'analysis' : 'analyses'} on this case (see
          the trail below).
        </p>
      )}

      {original && (
        <Section title="Original decision" aside={<Badge tone="neutral">{original.outcome}</Badge>}>
          <div className="flex flex-col gap-2 px-5 py-4 text-sm">
            <DecisionSummary decision={original} />
          </div>
        </Section>
      )}
      {appeal && <AppealBlock appeal={appeal} outcome={outcome} />}
    </section>
  );
}

export function HistoryPage() {
  const { id } = useParams();
  const { data: user } = useSession();
  const staff = OVERSIGHT_ROLES.includes(user?.role);
  const history = useQuery({ queryKey: ['history', id], queryFn: () => contentApi.history(id) });
  return (
    <div className="mx-auto max-w-4xl">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="label mb-6 inline-block hover:text-fg"
      >
        ‹ Back
      </button>
      <PageHeader eyebrow="Moderation history" title="History" />
      <QueryState query={history}>
        {(data) => (
          <div className="flex flex-col gap-8">
            <Section
              title={data.content.type}
              aside={<VisibilityBadge visibility={data.content.visibility} />}
            >
              <p className="whitespace-pre-wrap break-words px-5 py-4 text-[15px] leading-relaxed">
                {data.content.body}
              </p>
            </Section>
            {[...data.cases].reverse().map((kase) => (
              <CaseHistory key={kase._id} kase={kase} data={data} staff={staff} />
            ))}
            <Section title="Audit trail">
              <div className="p-5">
                {data.audit.length ? (
                  <Timeline events={data.audit} />
                ) : (
                  <p className="text-sm text-subtle">No events yet.</p>
                )}
              </div>
            </Section>
          </div>
        )}
      </QueryState>
    </div>
  );
}
