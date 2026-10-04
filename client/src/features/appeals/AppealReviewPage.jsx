import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { appealsApi } from '../../api/resources.js';
import { ActionBadge, AiLabel, Badge, VersionBadge, VisibilityBadge } from '../../components/Badge.jsx';
import { PageHeader } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { dateTime } from '../../lib/format.js';
import { ResolveForm } from './ResolveForm.jsx';

function Panel({ step, title, children }) {
  return (
    <section className="card flex flex-col fade-in">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3">
        <span className="font-mono text-[11px] text-accent">{step}</span>
        <h2 className="label">{title}</h2>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-5 py-4 text-sm">{children}</div>
    </section>
  );
}

function DecisionSummary({ decision }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionBadge action={decision.finalAction} />
        {decision.clauseCodes.map((c) => (
          <Badge key={c} tone="accent">
            {c}
          </Badge>
        ))}
        <VersionBadge version={decision.policyVersion} prefix="Decided under " />
      </div>
      {decision.rationale && <p className="text-muted">{decision.rationale}</p>}
      <p className="font-mono text-[11px] text-subtle">
        {decision.reviewerId?.name} · {dateTime(decision.createdAt)}
      </p>
    </>
  );
}

function OriginalDecision({ data }) {
  const { decision, analysis } = data.originalDecision;
  return (
    <Panel step="01" title="Original decision">
      <div className="rounded-lg border border-line bg-black/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="label">{data.content.type}</span>
          <VisibilityBadge visibility={data.content.visibility} />
        </div>
        <p className="whitespace-pre-wrap break-words">{data.content.body}</p>
        {data.parent && (
          <p className="mt-2 border-l border-line pl-2 text-xs text-subtle">Reply to: {data.parent.body}</p>
        )}
      </div>
      <DecisionSummary decision={decision} />
      {analysis && (
        <p className="text-xs text-subtle">
          The AI had proposed <ActionBadge action={analysis.recommendation.proposedAction} />
        </p>
      )}
    </Panel>
  );
}

function AppealEvidence({ data }) {
  const ev = data.appealEvidence;
  return (
    <Panel step="02" title="Appeal evidence">
      <div>
        <p className="label mb-1.5">Statement · {ev.author?.name}</p>
        <p className="whitespace-pre-wrap text-fg">“{ev.statement}”</p>
      </div>
      {ev.evidence && (
        <div>
          <p className="label mb-1.5">Evidence</p>
          <p className="whitespace-pre-wrap text-muted">{ev.evidence}</p>
        </div>
      )}
      {ev.policyChanged && ev.currentAnalysis && (
        <div className="rounded-lg border border-accent/35 bg-accent/[0.06] p-3 text-xs">
          The policy changed since the decision. The case was re-analysed under v
          {ev.currentAnalysis.policyVersion}: proposed{' '}
          <ActionBadge action={ev.currentAnalysis.recommendation.proposedAction} />
        </div>
      )}
      <div className="rounded-lg border border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Summary</span>
          <AiLabel />
        </div>
        {ev.aiSummary ? (
          <>
            <p className="text-muted">{ev.aiSummary.summary}</p>
            {ev.aiSummary.newPoints.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-xs text-subtle">
                {ev.aiSummary.newPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-subtle">
              The assistant summarises only. It does not vote on the outcome.
            </p>
          </>
        ) : (
          <p className="text-xs text-subtle">No summary available. Read the statement above.</p>
        )}
      </div>
      <p className="font-mono text-[11px] text-subtle">
        Submitted {dateTime(ev.submittedAt)} ·{' '}
        {ev.assignedReviewer ? `assigned to ${ev.assignedReviewer.name}` : 'unassigned'}
      </p>
    </Panel>
  );
}

function FinalOutcome({ data }) {
  return (
    <Panel step="03" title="Final outcome">
      {data.finalOutcome ? (
        <>
          <Badge tone="neutral">{data.finalOutcome.outcome}</Badge>
          <DecisionSummary decision={data.finalOutcome} />
        </>
      ) : data.canResolve ? (
        <ResolveForm appealId={data.appealId} original={data.originalDecision.decision} />
      ) : (
        <p className="text-subtle">
          Waiting for the assigned senior moderator. The moderator who made the original decision cannot
          resolve it.
        </p>
      )}
    </Panel>
  );
}

export function AppealReviewPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['appeal', id], queryFn: () => appealsApi.get(id) });
  return (
    <div>
      <Link to="/appeals" className="label mb-6 inline-block hover:text-fg">
        ‹ Appeals
      </Link>
      <PageHeader eyebrow="Second review" title="Appeal review" />
      <QueryState query={query}>
        {(data) => (
          <div className="grid gap-4 lg:grid-cols-3">
            <OriginalDecision data={data} />
            <AppealEvidence data={data} />
            <FinalOutcome data={data} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
