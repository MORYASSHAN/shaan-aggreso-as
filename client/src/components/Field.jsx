import { useId } from 'react';

/** A labelled field with an inline message underneath for validation errors. */
export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const messageId = `${id}-message`;
  const control = children({
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error || hint ? messageId : undefined,
  });
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p
          id={messageId}
          className={`text-xs ${error ? 'text-danger' : 'text-subtle'}`}
          role={error ? 'alert' : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function TextArea(props) {
  return (
    <textarea rows={4} {...props} className={`field resize-y leading-relaxed ${props.className ?? ''}`} />
  );
}

export function Input(props) {
  return <input {...props} className={`field ${props.className ?? ''}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`field appearance-none pr-8 ${props.className ?? ''}`}>
      {children}
    </select>
  );
}
