import { useState } from 'react';
import { Arrow, Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Field, TextArea } from '../../components/Field.jsx';
import { LIMITS } from '../../lib/constants.js';

export function Composer({ placeholder, submitLabel, mutation, onDone, compact = false }) {
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = body.trim();
  const fieldError =
    mutation.error?.fieldErrors?.body?.[0] ??
    (touched && !trimmed
      ? 'Text cannot be empty'
      : body.length > LIMITS.BODY_MAX
        ? 'Text must be 5,000 characters or fewer'
        : null);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!trimmed || body.length > LIMITS.BODY_MAX) return;
    mutation.mutate(trimmed, {
      onSuccess: () => {
        setBody('');
        setTouched(false);
        onDone?.();
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {mutation.error && !mutation.error.fieldErrors?.body && <ErrorBanner error={mutation.error} />}
      <Field error={fieldError}>
        {(a11y) => (
          <TextArea
            {...a11y}
            aria-label={placeholder}
            rows={compact ? 2 : 3}
            placeholder={placeholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        )}
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`font-mono text-[11px] ${body.length > LIMITS.BODY_MAX ? 'text-danger' : 'text-subtle'}`}
        >
          {body.length.toLocaleString()} / 5,000
        </span>
        <Button
          type="submit"
          variant="primary"
          size={compact ? 'sm' : 'md'}
          busy={mutation.isPending}
          busyLabel="Posting…"
        >
          {submitLabel} <Arrow />
        </Button>
      </div>
    </form>
  );
}
