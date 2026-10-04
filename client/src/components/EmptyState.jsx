/** A short sentence and the next step. */
export function EmptyState({ title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center fade-in">
      <p className="text-sm text-fg">{title}</p>
      {children && <p className="max-w-sm text-sm text-subtle">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
