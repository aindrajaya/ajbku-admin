import React from 'react';
import { Navigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthProvider';
import { canAccess, routeAccess } from '../auth/access';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === 'booting') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--color-emerald)' }}>
        Memuat AJBku...
      </div>
    );
  }

  if (status === 'anonymous' || status === 'credential-authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RoleRoute({
  accessKey,
  children,
}: {
  accessKey: keyof typeof routeAccess;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!canAccess(user?.roles, accessKey)) {
    return <Navigate to="/" replace search={{ blockedFrom: pathname }} />;
  }

  return <>{children}</>;
}
