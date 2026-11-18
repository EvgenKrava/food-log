import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { oidcConfig } from './auth';
import { App } from './App';
import { I18nProvider, useI18n } from './i18n';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

// A locale change remounts the app so every plain tr() call re-renders.
function LocalizedApp() {
  return <App key={useI18n().locale} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing');

createRoot(root).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <LocalizedApp />
        </I18nProvider>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);
