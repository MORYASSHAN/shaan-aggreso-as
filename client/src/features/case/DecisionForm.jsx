import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { casesApi } from '../../api/resources.js';
import { Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Field, Select, TextArea } from '../../components/Field.jsx';
import { Section } from '../../components/Page.jsx';
import { useToast } from '../../components/Toast.jsx';
import { ACTIONS } from '../../lib/constants.js';
import { actionPhrase } from '../../lib/format.js';
import { validateDecision } from './decisionSchema.js';

const OUTCOMES = [
  { value: 'approved', title: 'Approve', hint: 'Take the proposed action' },
  { value: 'rejected', title: 'Reject', hint: 'No violation' },
  { value: 'modified', title: 'Modify', hint: 'Different action or clause' },
];

function successMessage(decision) {
  const what =
    decision.finalAction === 'none'
      ? 'No action taken'
      : `Content ${decision.finalAction === 'remove' ? 'removed' : `${decision.finalAction}ed`}`;
  const under = decision.clauseCodes.length ? ` under ${decision.clauseCodes.join(', ')}` : '';
  return `Decision saved. ${what}${under}, policy v${decision.policyVersion}.`;
}

/** The human decision. Buttons say exactly what the human is doing. */
export function DecisionForm({ caseId, analysis, clauses, recommendedClauses }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const proposed = analysis.recommendation.proposedAction;
  const [form, setForm] = useState({
    outcome: 'approved',
    finalAction: proposed,
    clauseCodes: recommendedClauses,
    rationale: '',
  });
  const [touched, setTouched] = useState(false);
  const errors = touched ? validateDecision(form) : {};
  const valid = Object.keys(validateDecision(form)).length === 0;
  const decide = useMutation({
    mutationFn: (body) => casesApi.decide(caseId, body),
    onSuccess: (decision) => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['case', caseId] });
      toast(successMessage(decision));
      navigate('/queue');
    },
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleClause = (code) =>
    set({
      clauseCodes: form.clauseCodes.includes(code)
        ? form.clauseCodes.filter((c) => c !== code)
        : [...form.clauseCodes, code],
    });

  const submitLabel = {
    approved: `Approve: ${actionPhrase(proposed)}`,
    rejected: 'Reject: take no action',
    modified: `Modify: ${actionPhrase(form.finalAction ?? 'none')}`,
  }[form.outcome];

  const onSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const body = { outcome: form.outcome, analysisId: analysis._id, rationale: form.rationale.trim() };
    if (form.outcome === 'modified')
      Object.assign(body, { finalAction: form.finalAction, clauseCodes: form.clauseCodes });
    decide.mutate(body);
  };

  return (
    <Section title="Your decision">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-5 py-4">
        {decide.error && <ErrorBanner error={decide.error} />}
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Decision">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={form.outcome === o.value}
              onClick={() => set({ outcome: o.value })}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                form.outcome === o.value
                  ? 'border-accent/60 bg-accent/[0.07]'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <span className="block text-sm text-fg">{o.title}</span>
              <span className="block text-[11px] text-subtle">{o.hint}</span>
            </button>
          ))}
        </div>

        {form.outcome === 'modified' && (
          <div className="flex flex-col gap-4 fade-in">
            <Field label="Action" error={errors.finalAction}>
              {(a11y) => (
                <Select
                  {...a11y}
                  value={form.finalAction ?? ''}
                  onChange={(e) => set({ finalAction: e.target.value || undefined })}
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <fieldset>
              <legend className="label mb-2">Clauses</legend>
              <div className="flex flex-wrap gap-1.5">
                {clauses.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    aria-pressed={form.clauseCodes.includes(c.code)}
                    title={c.text}
                    onClick={() => toggleClause(c.code)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors duration-150 ${
                      form.clauseCodes.includes(c.code)
                        ? 'border-accent/60 bg-accent/10 text-fg'
                        : 'border-line text-muted hover:border-line-strong'
                    }`}
                  >
                    {c.code} · {c.title}
                  </button>
                ))}
              </div>
              {errors.clauseCodes && <p className="mt-1.5 text-xs text-danger">{errors.clauseCodes}</p>}
            </fieldset>
          </div>
        )}

        <Field
          label={form.outcome === 'modified' ? 'Rationale (required)' : 'Rationale (optional)'}
          error={errors.rationale}
        >
          {(a11y) => (
            <TextArea
              {...a11y}
              rows={3}
              value={form.rationale}
              onChange={(e) => set({ rationale: e.target.value })}
              placeholder="Why this decision?"
            />
          )}
        </Field>

        <Button type="submit" variant="primary" busy={decide.isPending} disabled={touched && !valid}>
          {submitLabel}
        </Button>
      </form>
    </Section>
  );
}
