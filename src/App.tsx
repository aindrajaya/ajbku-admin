import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Components & Layout
import Layout from './components/Layout';

// Views
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import IntakeQueue from './views/IntakeQueue';
import Matters from './views/Matters';
import MatterDetail from './views/MatterDetail';
import Schedules from './views/Schedules';
import ChatInbox from './views/ChatInbox';
import Moderation from './views/Moderation';
import AuditTrail from './views/AuditTrail';
import Invitations from './views/Invitations';
import { tokenManager } from './api/client';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Initialize theme synchronously on load to prevent flash of wrong mode
const initialTheme = localStorage.getItem('ajbku-theme') || 'light';
document.documentElement.setAttribute('data-theme', initialTheme);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check login status on startup and listen to logouts.
  // IMPORTANT: tokenManager.get() reads from Electron IPC/sessionStorage AND
  // populates the in-memory cache so subsequent interceptor calls (getSync) work.
  useEffect(() => {
    async function checkAuth() {
      // Pre-load both tokens into the in-memory cache eagerly
      const accessToken = await tokenManager.get('accessToken');
      await tokenManager.get('refreshToken'); // warm cache for refresh flow
      await tokenManager.get('tenantId'); // warm cache for tenantId

      if (!accessToken) {
        setIsAuthenticated(false);
        return;
      }

      // Check if the access token is still valid by expiry timestamp
      const expiresAt = await tokenManager.get('tokenExpiresAt');
      const isExpired = expiresAt ? Date.now() > Number(expiresAt) : false;

      if (!isExpired) {
        // Token is valid — let the user in immediately
        setIsAuthenticated(true);
        return;
      }

      // Token is expired — attempt a silent refresh before forcing re-login
      console.log('[AJBku] Access token expired on startup, attempting silent refresh...');
      const refreshToken = await tokenManager.get('refreshToken');
      if (!refreshToken) {
        await tokenManager.clearAll();
        setIsAuthenticated(false);
        return;
      }

      try {
        const { getApiBaseUrl } = await import('./api/client');
        const baseUrl = getApiBaseUrl();
        // Use a bare fetch to avoid triggering the Axios interceptor loop
        const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (res.ok) {
          const { accessToken: newAccess, refreshToken: newRefresh } = await res.json();
          tokenManager.setSync('accessToken', newAccess);
          await tokenManager.set('accessToken', newAccess);
          await tokenManager.set('refreshToken', newRefresh);
          await tokenManager.set('tokenExpiresAt', String(Date.now() + 15 * 60 * 1000));
          console.log('[AJBku] Silent refresh succeeded.');
          setIsAuthenticated(true);
        } else {
          console.warn('[AJBku] Silent refresh returned', res.status, '— forcing re-login.');
          await tokenManager.clearAll();
          setIsAuthenticated(false);
        }
      } catch (err) {
        // Network error — might be offline; let old token through and let live requests decide
        console.warn('[AJBku] Silent refresh network error, proceeding with cached token.', err);
        setIsAuthenticated(true);
      }
    }

    checkAuth();


    // Listen to ajbku-logout events triggered by failed token refresh
    const handleLogout = async () => {
      await tokenManager.clearAll();
      setIsAuthenticated(false);
    };

    window.addEventListener('ajbku-logout', handleLogout);
    return () => {
      window.removeEventListener('ajbku-logout', handleLogout);
    };
  }, []);

  if (isAuthenticated === null) {
    // Render loading splash screen adaptive to current theme
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--color-emerald)',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(16, 185, 129, 0.1)',
            borderTopColor: '#10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Memuat AJBku...</span>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          {/* Public Login Route */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login onLoginSuccess={() => setIsAuthenticated(true)} />
            } 
          />

          {/* Protected Routes inside Shell Layout */}
          <Route 
            path="/" 
            element={
              isAuthenticated ? <Layout onLogout={() => setIsAuthenticated(false)} /> : <Navigate to="/login" replace />
            }
          >
            <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="queue" element={<ErrorBoundary><IntakeQueue /></ErrorBoundary>} />
            <Route path="matters" element={<ErrorBoundary><Matters /></ErrorBoundary>} />
            <Route path="matters/:id" element={<ErrorBoundary><MatterDetail /></ErrorBoundary>} />
            <Route path="schedules" element={<ErrorBoundary><Schedules /></ErrorBoundary>} />
            <Route path="chat" element={<ErrorBoundary><ChatInbox /></ErrorBoundary>} />
            <Route path="moderation" element={<ErrorBoundary><Moderation /></ErrorBoundary>} />
            <Route path="audit" element={<ErrorBoundary><AuditTrail /></ErrorBoundary>} />
            <Route path="invitations" element={<ErrorBoundary><Invitations /></ErrorBoundary>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
