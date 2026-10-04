import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { contentApi } from '../../api/resources.js';
import { Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Field, Input, Select } from '../../components/Field.jsx';
import { useToast } from '../../components/Toast.jsx';
import { REPORT_REASONS } from '../../lib/constants.js';

/** Inline report form. One report per user per item; the server says so if you try twice. */
export function ReportForm({ contentId, onClose }) {
  const toast = useToast();
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const report = useMutation({ mutationFn: (body) => contentApi.report(contentId, body) });

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!reasonCode) return;
    report.mutate(
      { reasonCode, note },
      {
        onSuccess: () => {
          toast('Report sent. A moderator will review it.');
          onClose();
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-black/40 p-3 fade-in"
    >
      {report.error && <ErrorBanner error={report.error} />}
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="Reason" error={touched && !reasonCode ? 'Choose a reason' : null}>
          {(a11y) => (
            <Select {...a11y} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="">Select…</option>
              {REPORT_REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note (optional)">
          {(a11y) => (
            <Input
              {...a11y}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's wrong with it?"
            />
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" busy={report.isPending} busyLabel="Sending…">
          Send report
        </Button>
      </div>
    </form>
  );
}
