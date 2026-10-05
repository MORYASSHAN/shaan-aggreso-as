import { Navigate, useLocation } from 'react-router';
import { EmptyState } from '../../components/EmptyState.jsx';
import { useSession } from './session.js';

export function RequireRole({ roles, children }) {
  const { data: user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState title="This page isn't available for your role.">
        Use the navigation above to continue.
      </EmptyState>
    );
  }
  return children;
}
