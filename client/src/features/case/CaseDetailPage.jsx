import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { casesApi } from '../../api/resources.js';
import { ActionBadge, Badge, StatusBadge, VersionBadge, VisibilityBadge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { PageHeader, Section } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { useToast } from '../../components/Toast.jsx';
import { CASE_STATUS, MODERATOR_ROLES } from '../../lib/constants.js';
import { dateTime, humanize, shortId, timeAgo } from '../../lib/format.js';
import { useSession } from '../auth/session.js';
import { DecisionForm } from './DecisionForm.jsx';
import { Findings } from './Findings.jsx';
import { HighlightedText } from './HighlightedText.jsx';
import { RecommendationCard } from './RecommendationCard.jsx';

const UNRESOLVED = [CASE_STATUS.PENDING_ANALYSIS, CASE_STATUS.AWAITING_REVIEW, CASE_STATUS.APPEAL_PENDING];

function Notice({ tone = 'accent', children }) {
  const styles =
    tone === 'danger' ? 'border-danger/35 bg-danger/[0.06]' : 'border-accent/35 bg-accent/[0.06]';
  return <div className={`rounded-lg border px-4 py-3 text-sm fade-in ${styles}`}>{children}</div>;
}

function verifiedRanges(analysis) {
  return [...analysis.ruleFindings, ...analysis.aiFindings].flatMap((f) =>
    f.evidence.filter((e) => e.verified && e.start != null),
  );
}

function recommendedClauses(analysis) {
  const ai = analysis.aiFindings.filter((f) => !f.invalidCitation).map((f) => f.clauseCode);
  const codes = ai.length ? ai : analysis.ruleFindings.map((f) => f.clauseCode);
  return [...new Set(codes)];
}

function ContentPanel({ data }) {
  const { content, parent, reports, analysis } = data;
  const removed = content.visibility === 'removed';
  return (
    <Section
      title={`${content.type} by ${content.authorId?.name ?? 'unknown'}`}
      aside={<VisibilityBadge visibility={content.visibility} />}
    >
      <div className={`px-5 py-4 ${removed ? 'opacity-50' : ''}`}>
        {analysis ? (
          <HighlightedText text={content.body} ranges={verifiedRanges(analysis)} />
        ) : (
          <p className="whitespace-pre-wrap">{content.body}</p>
        )}
        <p className="mt-3 font-mono text-[11px] text-subtle">Posted {dateTime(content.createdAt)}</p>
      </div>
      {parent && (
        <div className="border-t border-line px-5 py-4">
          <p className="label mb-2">Replying to {parent.authorId?.name}</p>
          <p className="whitespace-pre-wrap text-sm text-muted">{parent.body}</p>
        </div>
      )}
      {reports.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <p className="label mb-2">Reports · {reports.length}</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {reports.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">{humanize(r.reasonCode)}</Badge>
                <span className="text-muted">{r.note || 'No note'}</span>
                <span className="font-mono text-[11px] text-subtle">
                  {r.reporterId?.name} · {timeAgo(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function Decisions({ decisions }) {
  if (!decisions.length) return null;
  return (
    <Section title="Decisions">
      <ul className="divide-y divide-line">
        {decisions.map((d) => (
          <li key={d._id} className="flex flex-col gap-1.5 px-5 py-3.5 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{d.stage}</Badge>
              <Badge tone="neutral">{d.outcome}</Badge>
              <ActionBadge action={d.finalAction} />
              {d.clauseCodes.map((c) => (
                <Badge key={c} tone="accent">
                  {c}
                </Badge>
              ))}
              <VersionBadge version={d.policyVersion} prefix="Decided under " />
            </div>
            {d.rationale && <p className="text-muted">{d.rationale}</p>}
            <p className="font-mono text-[11px] text-subtle">
              {d.reviewerId?.name} · {dateTime(d.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PastAnalyses({ analyses }) {
  if (!analyses.length) return null;
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3">
        <span className="label">Older analyses · {analyses.length}</span>
        <span className="text-subtle transition-transform duration-200 group-open:rotate-90">›</span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {analyses.map((a) => (
          <li key={a._id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
            <VersionBadge version={a.policyVersion} />
            <ActionBadge action={a.recommendation.proposedAction} />
            <span className="text-muted">
              {[...a.ruleFindings, ...a.aiFindings].map((f) => f.clauseCode).join(', ') || 'No findings'}
            </span>
            <span className="ml-auto font-mono text-[11px] text-subtle">{dateTime(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CaseActions({ data }) {
  const qc = useQueryClient();
  const toast = useToast();
  const id = data.case._id;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case', id] });
    qc.invalidateQueries({ queryKey: ['queue'] });
  };
  const reopen = useMutation({
    mutationFn: () => casesApi.reopen(id),
    onSuccess: () => (refresh(), toast('Case reopened and back in the queue.')),
  });
  const reanalyze = useMutation({
    mutationFn: () => casesApi.reanalyze(id),
    onSuccess: () => (refresh(), toast('Re-analysed under the active policy.')),
  });
  const error = reopen.error ?? reanalyze.error;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {data.case.status === CASE_STATUS.AUTO_CLEARED && (
          <Button size="sm" onClick={() => reopen.mutate()} busy={reopen.isPending} busyLabel="Reopening…">
            Reopen
          </Button>
        )}
        {UNRESOLVED.includes(data.case.status) && (
          <Button
            size="sm"
            onClick={() => reanalyze.mutate()}
            busy={reanalyze.isPending}
            busyLabel="Analysing…"
          >
            Re-analyse
          </Button>
        )}
      </div>
      {error && <ErrorBanner error={error} />}
    </div>
  );
}

function CaseBody({ data, canModerate }) {
  const { case: kase, analysis } = data;
  const awaiting = kase.status === CASE_STATUS.AWAITING_REVIEW && analysis;
  return (
    <div className="flex flex-col gap-4">
      {!canModerate && (
        <Notice>Read-only view. Admins can inspect cases, but only moderators make decisions.</Notice>
      )}
      {data.aiUnavailable && (
        <Notice tone="danger">
          AI review unavailable. Showing rule findings only; a person must review this case.
        </Notice>
      )}
      {kase.policyChangedFrom && analysis && kase.policyChangedFrom !== analysis.policyVersion && (
        <Notice>
          Re-analysed under v{analysis.policyVersion} (was v{kase.policyChangedFrom}).{' '}
          <Link
            to={`/policy?from=${kase.policyChangedFrom}&to=${analysis.policyVersion}`}
            className="underline decoration-accent/50 underline-offset-4 hover:text-accent"
          >
            See what changed
          </Link>
        </Notice>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <ContentPanel data={data} />
          {analysis && <Findings analysis={analysis} />}
          <Decisions decisions={data.decisions} />
          <PastAnalyses analyses={data.pastAnalyses} />
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {analysis ? (
            <RecommendationCard analysis={analysis} aiUnavailable={data.aiUnavailable} />
          ) : (
            <Notice>Analysis is still running. Refresh in a moment.</Notice>
          )}
          {awaiting && canModerate && (
            <DecisionForm
              caseId={kase._id}
              analysis={analysis}
              clauses={data.policy?.clauses ?? []}
              recommendedClauses={recommendedClauses(analysis)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function CaseDetailPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['case', id], queryFn: () => casesApi.get(id) });
  const { data: user } = useSession();
  const canModerate = MODERATOR_ROLES.includes(user?.role);
  return (
    <div>
      <Link to="/queue" className="label mb-6 inline-block hover:text-fg">
        ‹ Queue
      </Link>
      <QueryState query={query}>
        {(data) => (
          <>
            <PageHeader
              eyebrow={`Case ${shortId(data.case._id)} · ${humanize(data.case.trigger)} · priority ${data.case.priority}`}
              title={
                <span className="flex flex-wrap items-center gap-3">
                  Case detail <StatusBadge status={data.case.status} />
                </span>
              }
              action={canModerate && <CaseActions data={data} />}
            />
            <CaseBody data={data} canModerate={canModerate} />
          </>
        )}
      </QueryState>
    </div>
  );
}
