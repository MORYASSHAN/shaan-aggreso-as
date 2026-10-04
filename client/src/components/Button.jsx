const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.08em] ' +
  'transition-[background-color,border-color,color,opacity] duration-150 ease-(--ease-smooth) ' +
  'disabled:cursor-not-allowed disabled:opacity-40 select-none whitespace-nowrap';

const VARIANTS = {
  primary: 'bg-fg text-black border border-fg hover:bg-white',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong hover:bg-[#16161a]',
  ghost: 'text-muted border border-transparent hover:text-fg hover:border-line',
  danger: 'bg-transparent text-danger border border-danger/40 hover:border-danger/80',
};

const SIZES = {
  sm: 'h-7 px-2.5',
  md: 'h-9 px-3.5',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  busyLabel = 'Saving…',
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? busyLabel : children}
    </button>
  );
}

export function Arrow() {
  return <span aria-hidden="true">›</span>;
}
