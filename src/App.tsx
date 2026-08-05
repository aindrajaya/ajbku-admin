import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import AppFeedback from './components/AppFeedback';
import { AppRouterProvider } from './router';
import { RealtimeProvider } from './realtime/RealtimeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

document.documentElement.setAttribute('data-theme', localStorage.getItem('ajbku-theme') || 'light');

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <AppRouterProvider />
          <AppFeedback />
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
