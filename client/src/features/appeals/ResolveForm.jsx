import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { appealsApi } from '../../api/resources.js';
import { Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Field, Select, TextArea } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { ACTIONS, LIMITS } from '../../lib/constants.js';
import { actionPhrase } from '../../lib/format.js';

const OUTCOMES = [
  { value: 'upheld', title: 'Uphold', hint: 'Decision stands' },
  { value: 'overturned', title: 'Overturn', hint: 'Restore content' },
  { value: 'modified', title: 'Modify', hint: 'Different action' },
];

export function ResolveForm({ appealId, original }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [outcome, setOutcome] = useState('upheld');
  const [finalAction, setFinalAction] = useState(original.finalAction);
  const [rationale, setRationale] = useState('');
  const [touched, setTouched] = useState(false);
  const resolve = useMutation({
    mutationFn: (body) => appealsApi.resolve(appealId, body),
    onSuccess: ({ decision }) => {
      qc.invalidateQueries({ queryKey: ['appeal', appealId] });
      qc.invalidateQueries({ queryKey: ['appeals'] });
      toast(
        `Appeal resolved: ${decision.outcome}. Final action ${decision.finalAction}, policy v${decision.policyVersion}.`,
      );
    },
  });

  const rationaleError =
    resolve.error?.fieldErrors?.rationale?.[0] ??
    (touched && rationale.trim().length < LIMITS.RATIONALE_MIN
      ? `Explain the outcome in at least ${LIMITS.RATIONALE_MIN} characters`
      : null);
  const valid = rationale.trim().length >= LIMITS.RATIONALE_MIN;
  const label = {
    upheld: `Uphold: keep ${original.finalAction}`,
    overturned: 'Overturn: restore content',
    modified: `Modify: ${actionPhrase(finalAction)}`,
  }[outcome];

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const body = { outcome, rationale: rationale.trim() };
    if (outcome === 'modified')
      Object.assign(body, { finalAction, clauseCodes: finalAction === 'none' ? [] : original.clauseCodes });
    resolve.mutate(body);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {resolve.error && !resolve.error.fieldErrors?.rationale && <ErrorBanner error={resolve.error} />}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Outcome">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={outcome === o.value}
            onClick={() => setOutcome(o.value)}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
              outcome === o.value
                ? 'border-accent/60 bg-accent/[0.07]'
                : 'border-line hover:border-line-strong'
            }`}
          >
            <span className="block text-sm">{o.title}</span>
            <span className="block text-[11px] text-subtle">{o.hint}</span>
          </button>
        ))}
      </div>
      {outcome === 'modified' && (
        <Field label="New action" hint={`Keeps the clauses ${original.clauseCodes.join(', ') || '—'}`}>
          {(a11y) => (
            <Select {...a11y} value={finalAction} onChange={(e) => setFinalAction(e.target.value)}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="Rationale (required)" error={rationaleError}>
        {(a11y) => (
          <TextArea {...a11y} rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} />
        )}
      </Field>
      <Button type="submit" variant="primary" busy={resolve.isPending} disabled={touched && !valid}>
        {label}
      </Button>
    </form>
  );
}
