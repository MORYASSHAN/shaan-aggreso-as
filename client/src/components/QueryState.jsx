import { EmptyState } from './EmptyState.jsx';
import { ErrorBanner } from './ErrorBanner.jsx';
import { SkeletonRows } from './Skeleton.jsx';

/**
 * The loading / failure / empty states every screen shares.
 * Renders children(data) only when there is something to show.
 */
export function QueryState({ query, isEmpty, empty, loading, children }) {
  if (query.isLoading) return loading ?? <SkeletonRows />;
  if (query.isError) {
    return (
      <div className="p-4">
        <ErrorBanner error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (isEmpty?.(query.data)) return <EmptyState {...empty} />;
  return children(query.data);
}
