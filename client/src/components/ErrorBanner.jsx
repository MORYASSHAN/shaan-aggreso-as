import { Button } from './Button.jsx';

/**
 * Red banner with the server message and the requestId.
 * A 409 means the data changed, so it offers Reload instead of Retry.
 */
export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  const conflict = error.isConflict;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-danger/35 bg-danger/[0.06] px-4 py-3 fade-in"
    >
      <div className="min-w-0">
        <p className="text-sm text-fg">{error.message}</p>
        {error.requestId && (
          <p className="mt-1 font-mono text-[11px] text-subtle">
            {error.code} · request {error.requestId}
          </p>
        )}
      </div>
      {conflict ? (
        <Button size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      ) : (
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        )
      )}
    </div>
  );
}
