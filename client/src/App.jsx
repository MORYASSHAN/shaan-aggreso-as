import { Navigate, Route, Routes } from 'react-router';
import { ErrorBanner } from './components/ErrorBanner.jsx';
import { Layout } from './components/Layout.jsx';
import { SkeletonRows } from './components/Skeleton.jsx';
import { AppealReviewPage } from './features/appeals/AppealReviewPage.jsx';
import { AppealsQueuePage } from './features/appeals/AppealsQueuePage.jsx';
import { AuditPage } from './features/audit/AuditPage.jsx';
import { HistoryPage } from './features/audit/HistoryPage.jsx';
import { LoginPage } from './features/auth/LoginPage.jsx';
import { RequireRole } from './features/auth/RequireRole.jsx';
import { useSession } from './features/auth/session.js';
import { CaseDetailPage } from './features/case/CaseDetailPage.jsx';
import { FeedPage } from './features/feed/FeedPage.jsx';
import { MyContentPage } from './features/me/MyContentPage.jsx';
import { PolicyPage } from './features/policy/PolicyPage.jsx';
import { QueuePage } from './features/queue/QueuePage.jsx';
import { MODERATOR_ROLES, OVERSIGHT_ROLES, ROLES } from './lib/constants.js';

const guard = (element, roles) => <RequireRole roles={roles}>{element}</RequireRole>;

export function App() {
  const session = useSession();
  if (session.isLoading) return <SkeletonRows rows={3} />;
  if (session.isError) {
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorBanner error={session.error} onRetry={() => session.refetch()} />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={guard(<FeedPage />)} />
        <Route path="/me" element={guard(<MyContentPage />, [ROLES.AUTHOR])} />
        <Route path="/content/:id/history" element={guard(<HistoryPage />)} />
        <Route path="/queue" element={guard(<QueuePage />, OVERSIGHT_ROLES)} />
        <Route path="/cases/:id" element={guard(<CaseDetailPage />, OVERSIGHT_ROLES)} />
        <Route path="/appeals" element={guard(<AppealsQueuePage />, [ROLES.SENIOR, ROLES.ADMIN])} />
        <Route path="/appeals/:id" element={guard(<AppealReviewPage />, [...MODERATOR_ROLES, ROLES.ADMIN])} />
        <Route path="/policy" element={guard(<PolicyPage />)} />
        <Route path="/audit" element={guard(<AuditPage />, OVERSIGHT_ROLES)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
