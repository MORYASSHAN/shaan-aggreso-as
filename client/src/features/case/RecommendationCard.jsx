import { ActionBadge, AiLabel, Badge, SeverityBadge, VersionBadge } from '../../components/Badge.jsx';
import { Section } from '../../components/Page.jsx';
import { percent } from '../../lib/format.js';

export function RecommendationCard({ analysis, aiUnavailable }) {
  const rec = analysis.recommendation;
  const strongest = [...analysis.aiFindings].sort((a, b) => b.confidence - a.confidence)[0];
  return (
    <Section
      title="Recommendation"
      aside={aiUnavailable ? <Badge tone="warn">Rules only</Badge> : <AiLabel />}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="label mb-1.5">Proposed</dt>
            <dd>
              <ActionBadge action={rec.proposedAction} />
            </dd>
          </div>
          <div>
            <dt className="label mb-1.5">Severity</dt>
            <dd>
              <SeverityBadge severity={rec.severity} title={strongest?.severityReason} />
            </dd>
          </div>
          <div>
            <dt className="label mb-1.5">Confidence</dt>
            <dd className="font-mono text-sm">{aiUnavailable ? '—' : percent(rec.confidence)}</dd>
          </div>
        </dl>
        {strongest && (
          <p className="text-xs text-subtle">
            {strongest.severityReason} {strongest.confidenceReason}
          </p>
        )}
        <p className="text-sm text-muted">{rec.summary}</p>
        {rec.needsHumanReasons.length > 0 && (
          <div>
            <p className="label mb-2">Why a human must decide</p>
            <ul className="flex flex-col gap-1.5">
              {rec.needsHumanReasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-line pt-3">
          <VersionBadge version={analysis.policyVersion} prefix="Analysed under " />
        </div>
      </div>
    </Section>
  );
}
