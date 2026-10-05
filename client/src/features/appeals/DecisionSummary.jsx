import { ActionBadge, Badge, VersionBadge } from '../../components/Badge.jsx';
import { dateTime } from '../../lib/format.js';

export function DecisionSummary({ decision }) {
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
