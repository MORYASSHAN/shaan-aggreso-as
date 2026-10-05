import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { policiesApi } from '../../api/resources.js';
import { Arrow, Button, buttonClass } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { TextArea } from '../../components/Field.jsx';
import { Section } from '../../components/Page.jsx';
import { useToast } from '../../components/Toast.jsx';
import EXAMPLE_V2 from '../../../../policies/policy.v2.json';

function ReevaluationProgress({ runId }) {
  const run = useQuery({
    queryKey: ['reevaluation', runId],
    queryFn: () => policiesApi.run(runId),
    refetchInterval: (q) => (q.state.data?.status === 'completed' ? false : 1000),
  });
  if (!run.data) return null;
  const { processed, total, failed, skipped, status, toVersion } = run.data;
  const pct = total ? Math.round((processed / total) * 100) : 100;
  return (
    <div className="flex flex-col gap-2 fade-in" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          {status === 'completed'
            ? `Re-evaluation under v${toVersion} complete`
            : `Re-evaluating unresolved cases under v${toVersion}…`}
        </span>
        <span className="font-mono text-subtle">
          {processed}/{total}
          {skipped ? ` · ${skipped} skipped` : ''}
          {failed ? ` · ${failed} failed` : ''}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-(--ease-smooth)"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// The server validates the draft and assigns the version number.
export function PublishPolicy() {
  const qc = useQueryClient();
  const toast = useToast();
  const policies = useQuery({ queryKey: ['policies'], queryFn: policiesApi.list });
  const active = policies.data?.items.find((p) => p.status === 'active');
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState(null);
  const [runId, setRunId] = useState(null);
  const publish = useMutation({
    mutationFn: policiesApi.publish,
    onSuccess: ({ policy, reevaluationRunId }) => {
      setRunId(reevaluationRunId);
      setDraft('');
      setSource(null);
      qc.invalidateQueries({ queryKey: ['policies'] });
      toast(`Policy v${policy.version} is now active. Re-evaluating open cases.`);
    },
  });

  const loadText = (text, label) => {
    publish.reset();
    setDraft(text);
    setSource(label);
  };
  const load = (json, label) => loadText(JSON.stringify(json, null, 2), label);

  const onFile = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (picked) loadText(await picked.text(), picked.name);
  };

  let parsed = null;
  let parseError = null;
  if (draft.trim()) {
    try {
      parsed = JSON.parse(draft);
    } catch (err) {
      parseError = `Not valid JSON: ${err.message}`;
    }
  }
  const fieldErrors = publish.error?.fieldErrors?.policy;

  return (
    <Section title="Publish a new version">
      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-sm text-muted">
          Published versions are never edited. Publishing makes the new version active and re-analyses
          unresolved cases only; past decisions keep their version.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => load(EXAMPLE_V2, 'Example: policy.v2.json')}>
            Load example v2
          </Button>
          <Button
            size="sm"
            disabled={!active}
            onClick={() =>
              load({ changelog: '', clauses: active.clauses }, `Copy of active v${active.version}`)
            }
          >
            Start from active version
          </Button>
          <label className={`${buttonClass('secondary', 'sm')} cursor-pointer`}>
            Upload .json
            <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
          </label>
        </div>
        {source && (
          <div className="flex flex-col gap-2">
            <p className="label">Draft · {source}</p>
            <TextArea
              aria-label="Policy JSON"
              rows={14}
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-[12px]"
            />
            {parseError && <p className="text-xs text-danger">{parseError}</p>}
            {parsed?.changelog && <p className="text-xs text-subtle">Changelog: {parsed.changelog}</p>}
          </div>
        )}
        {publish.error && <ErrorBanner error={publish.error} />}
        {fieldErrors && (
          <ul className="list-disc pl-5 font-mono text-[11px] text-danger">
            {fieldErrors.slice(0, 6).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <Button
          variant="primary"
          disabled={!parsed}
          busy={publish.isPending}
          busyLabel="Publishing…"
          onClick={() => publish.mutate(parsed)}
        >
          Publish version <Arrow />
        </Button>
        {runId && <ReevaluationProgress runId={runId} />}
      </div>
    </Section>
  );
}
