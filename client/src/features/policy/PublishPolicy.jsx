import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { policiesApi } from '../../api/resources.js';
import { Arrow, Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Section } from '../../components/Page.jsx';
import { useToast } from '../../components/Toast.jsx';

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

/** Admin publishes a new version from a JSON file. The server validates it and assigns the version number. */
export function PublishPolicy() {
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [runId, setRunId] = useState(null);
  const publish = useMutation({
    mutationFn: policiesApi.publish,
    onSuccess: ({ policy, reevaluationRunId }) => {
      setRunId(reevaluationRunId);
      qc.invalidateQueries({ queryKey: ['policies'] });
      toast(`Policy v${policy.version} is now active. Re-evaluating open cases.`);
    },
  });

  const onFile = async (e) => {
    setParseError(null);
    setFile(null);
    const picked = e.target.files?.[0];
    if (!picked) return;
    try {
      setFile({ name: picked.name, json: JSON.parse(await picked.text()) });
    } catch {
      setParseError('That file is not valid JSON.');
    }
  };

  const fieldErrors = publish.error?.fieldErrors?.policy;

  return (
    <Section title="Publish a new version">
      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-sm text-muted">
          Published versions are never edited. Publishing makes the new version active and re-analyses
          unresolved cases only; past decisions keep their version.
        </p>
        <label className="card card-hover flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm">{file ? file.name : 'Choose a policy .json file'}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle">Browse</span>
          <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
        </label>
        {parseError && <p className="text-xs text-danger">{parseError}</p>}
        {file?.json?.changelog && <p className="text-xs text-subtle">Changelog: {file.json.changelog}</p>}
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
          disabled={!file}
          busy={publish.isPending}
          busyLabel="Publishing…"
          onClick={() => publish.mutate(file.json)}
        >
          Publish version <Arrow />
        </Button>
        {runId && <ReevaluationProgress runId={runId} />}
      </div>
    </Section>
  );
}
