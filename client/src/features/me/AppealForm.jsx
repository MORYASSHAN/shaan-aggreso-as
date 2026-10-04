import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { appealsApi } from '../../api/resources.js';
import { Arrow, Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Field, TextArea } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { LIMITS } from '../../lib/constants.js';

export function AppealForm({ decision, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [statement, setStatement] = useState('');
  const [evidence, setEvidence] = useState('');
  const [touched, setTouched] = useState(false);
  const submit = useMutation({ mutationFn: (body) => appealsApi.submit(decision._id, body) });

  const length = statement.trim().length;
  const statementError =
    submit.error?.fieldErrors?.statement?.[0] ??
    (touched && length < LIMITS.APPEAL_MIN
      ? `Explain why in at least ${LIMITS.APPEAL_MIN} characters`
      : length > LIMITS.APPEAL_MAX
        ? 'Statement must be 2,000 characters or fewer'
        : null);
  const valid = length >= LIMITS.APPEAL_MIN && length <= LIMITS.APPEAL_MAX;

  const onSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    submit.mutate(
      { statement: statement.trim(), evidence: evidence.trim() },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['my-content'] });
          toast('Appeal sent. A different moderator will review it.');
          onClose();
        },
      },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-4 flex flex-col gap-4 rounded-lg border border-line bg-black/40 p-4 fade-in"
    >
      {submit.error && !submit.error.fieldErrors?.statement && <ErrorBanner error={submit.error} />}
      <Field
        label="Why should this decision change?"
        error={statementError}
        hint={!statementError ? `${length} / 2,000 · at least 20` : null}
      >
        {(a11y) => <TextArea {...a11y} value={statement} onChange={(e) => setStatement(e.target.value)} />}
      </Field>
      <Field label="Evidence or context (optional)">
        {(a11y) => (
          <TextArea
            {...a11y}
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Links, quotes or anything the reviewer should know"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          type="submit"
          busy={submit.isPending}
          busyLabel="Sending…"
          disabled={touched && !valid}
        >
          Submit appeal <Arrow />
        </Button>
      </div>
    </form>
  );
}
