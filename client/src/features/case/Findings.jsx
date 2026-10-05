import { AiLabel, Badge, SeverityBadge } from '../../components/Badge.jsx';
import { Section } from '../../components/Page.jsx';
import { percent } from '../../lib/format.js';

function SourceBadge({ finding }) {
  return finding.source === 'rule' ? <Badge tone="info">Rule · {finding.ruleId}</Badge> : <AiLabel />;
}

function ConfirmedEvidence({ findings }) {
  const withEvidence = findings.filter((f) => f.evidence.length > 0);
  return (
    <Section
      title="Confirmed evidence"
      aside={<span className="font-mono text-[11px] text-subtle">verified in the text</span>}
    >
      {withEvidence.length === 0 ? (
        <p className="px-5 py-4 text-sm text-subtle">No quote from either layer was found in the text.</p>
      ) : (
        <ul className="divide-y divide-line">
          {withEvidence.map((f, i) => (
            <li key={i} className="flex flex-col gap-2 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">{f.clauseCode}</Badge>
                <SourceBadge finding={f} />
                <SeverityBadge severity={f.severity} title={f.severityReason} />
              </div>
              {f.evidence.map((e, j) => (
                <blockquote key={j} className="border-l border-accent/50 pl-3 font-mono text-[13px] text-fg">
                  “{e.quote}”{' '}
                  <span className="text-subtle">
                    · chars {e.start}–{e.end}
                  </span>
                </blockquote>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Interpretation({ findings }) {
  const aiFindings = findings.filter((f) => f.source === 'ai');
  return (
    <Section title="Interpretation" aside={<AiLabel />}>
      {aiFindings.length === 0 ? (
        <p className="px-5 py-4 text-sm text-subtle">The AI added no interpretation.</p>
      ) : (
        <ul className="divide-y divide-line">
          {aiFindings.map((f, i) => (
            <li key={i} className="flex flex-col gap-2 px-5 py-3.5 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={f.invalidCitation ? 'danger' : 'accent'}>{f.clauseCode}</Badge>
                {f.invalidCitation && <Badge tone="danger">Invalid citation</Badge>}
                <SeverityBadge severity={f.severity} />
                <span className="font-mono text-[11px] text-muted">{percent(f.confidence)} confidence</span>
              </div>
              {f.interpretation && <p className="text-muted">{f.interpretation}</p>}
              <dl className="grid gap-1 text-xs text-subtle sm:grid-cols-[90px_1fr]">
                <dt>Severity</dt>
                <dd>{f.severityReason}</dd>
                <dt>Confidence</dt>
                <dd>{f.confidenceReason}</dd>
              </dl>
              {f.notes?.map((n, j) => (
                <p key={j} className="text-xs text-warn">
                  {n}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function Findings({ analysis }) {
  const all = [...analysis.ruleFindings, ...analysis.aiFindings];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ConfirmedEvidence findings={all} />
      <Interpretation findings={all} />
    </div>
  );
}
