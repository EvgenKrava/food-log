import { useSyncExternalStore } from 'react';

// A tiny history router: the app has a handful of flat routes, so a library is not worth it.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener('popstate', notify);

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  notify();
  window.scrollTo(0, 0);
}

const snapshot = () => window.location.pathname + window.location.search;

export function useLocation(): { path: string; query: URLSearchParams } {
  const href = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
  );
  const url = new URL(href, window.location.origin);
  return { path: url.pathname, query: url.searchParams };
}
