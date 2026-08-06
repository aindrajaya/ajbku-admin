import React, { Suspense, lazy } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import AppShell from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './auth/AuthProvider';
import { canAccess } from './auth/access';
import AuditTrail from './views/AuditTrail';
import ChatInbox from './views/ChatInbox';
import Dashboard from './views/Dashboard';
import IntakeNew from './views/IntakeNew';
import IntakeQueue from './views/IntakeQueue';
import Invitations from './views/Invitations';
import Login from './views/Login';
import MatterAssignment from './views/MatterAssignment';
import MatterBpn from './views/MatterBpn';
import Moderation from './views/Moderation';
import MatterEscrow from './views/MatterEscrow';
import Schedules from './views/Schedules';
import EscrowPayouts from './views/EscrowPayouts';

const Matters = lazy(() => import('./views/Matters'));
const MatterDetail = lazy(() => import('./views/MatterDetail'));
const MatterVerify = lazy(() => import('./views/MatterVerify'));
const EscrowDashboard = lazy(() => import('./views/EscrowDashboard'));
const ReportsOperational = lazy(() => import('./views/ReportsOperational'));
const ReportsRepertorium = lazy(() => import('./views/ReportsRepertorium'));
const Settings = lazy(() => import('./views/Settings'));

function logRouteRedirect(reason: string, details?: Record<string, unknown>) {
  console.info('[auth] route-redirect', { reason, ...(details || {}) });
}

function ProtectedLayout() {
  const { status } = useAuth();
  if (status === 'booting') {
    return <div className="grid h-screen place-items-center text-emerald-500">Memuat AJBku...</div>;
  }
  if (status === 'anonymous' || status === 'credential-authenticated') {
    logRouteRedirect('protected-layout-blocked', { status });
    return <Navigate to="/auth/login" replace />;
  }
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'authenticated') {
    logRouteRedirect('login-route-blocked', { status });
    return <Navigate to="/" replace />;
  }
  return <Login />;
}

function RouteLoading() {
  return <div className="grid min-h-[320px] place-items-center text-sm text-slate-300">Memuat modul...</div>;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

function GuardedPage({ accessKey, children }: { accessKey: Parameters<typeof canAccess>[1]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!canAccess(user?.roles, accessKey)) {
    return <Navigate to="/" replace />;
  }
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <Navigate to="/auth/login" replace />,
});

const totpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login/totp',
  component: () => <Navigate to="/auth/totp" replace />,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginRoute,
});

const authTotpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/totp',
  component: LoginRoute,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: ProtectedLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: () => <GuardedPage accessKey="dashboard"><Dashboard /></GuardedPage>,
});

const queueRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/queue',
  component: () => <GuardedPage accessKey="queue"><IntakeQueue /></GuardedPage>,
});

const intakeNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/intake/new',
  component: () => <GuardedPage accessKey="intakeNew"><IntakeNew /></GuardedPage>,
});

const mattersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/matters',
  component: () => <GuardedPage accessKey="matters"><LazyPage><Matters /></LazyPage></GuardedPage>,
});

const matterDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/matters/$id',
  component: () => <GuardedPage accessKey="matters"><LazyPage><MatterDetail /></LazyPage></GuardedPage>,
});

const matterVerifyRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/matters/$id/verify',
  component: () => <GuardedPage accessKey="matters"><LazyPage><MatterVerify /></LazyPage></GuardedPage>,
});

const matterAssignmentRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/matters/$id/assignment',
  component: () => <GuardedPage accessKey="matters"><MatterAssignment /></GuardedPage>,
});

const matterEscrowRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/matters/$id/escrow',
  component: () => <GuardedPage accessKey="escrow"><MatterEscrow /></GuardedPage>,
});

const matterBpnRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/matters/$id/bpn',
  component: () => <GuardedPage accessKey="matters"><MatterBpn /></GuardedPage>,
});

const schedulesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/schedules',
  component: () => <GuardedPage accessKey="schedules"><Schedules /></GuardedPage>,
});

const chatRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/chat',
  component: () => <GuardedPage accessKey="chat"><ChatInbox /></GuardedPage>,
});

const escrowRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/escrow',
  component: () => <GuardedPage accessKey="escrow"><LazyPage><EscrowDashboard /></LazyPage></GuardedPage>,
});

const escrowPayoutsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/escrow/payouts',
  component: () => <GuardedPage accessKey="escrow"><EscrowPayouts /></GuardedPage>,
});

const moderationRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/moderation',
  component: () => <GuardedPage accessKey="moderation"><Moderation /></GuardedPage>,
});

const reportsOperationalRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/reports/operational',
  component: () => <GuardedPage accessKey="reports"><LazyPage><ReportsOperational /></LazyPage></GuardedPage>,
});

const reportsRepertoriumRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/reports/repertorium',
  component: () => <GuardedPage accessKey="reports"><LazyPage><ReportsRepertorium /></LazyPage></GuardedPage>,
});

const auditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/audit',
  component: () => <GuardedPage accessKey="audit"><AuditTrail /></GuardedPage>,
});

const invitationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/invitations',
  component: () => <GuardedPage accessKey="invitations"><Invitations /></GuardedPage>,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings',
  component: () => <GuardedPage accessKey="settings"><LazyPage><Settings /></LazyPage></GuardedPage>,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  totpRoute,
  authLoginRoute,
  authTotpRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    queueRoute,
    intakeNewRoute,
    mattersRoute,
    matterDetailRoute,
    matterVerifyRoute,
    matterAssignmentRoute,
    matterEscrowRoute,
    matterBpnRoute,
    schedulesRoute,
    chatRoute,
    escrowRoute,
    escrowPayoutsRoute,
    moderationRoute,
    reportsOperationalRoute,
    reportsRepertoriumRoute,
    auditRoute,
    invitationsRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultNotFoundComponent: () => <Navigate to="/" replace />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouterProvider() {
  return <RouterProvider router={router} />;
}
