import { useSyncExternalStore } from 'react';

// Hash routing, so the static build works under any path:
// #/ (story), #/dataset, #/compare, #/explore?run=eval%3Arules&week=30, #/live

export type Page = 'story' | 'dataset' | 'compare' | 'explore' | 'live';

const PAGES: Page[] = ['story', 'dataset', 'compare', 'explore', 'live'];

export interface Route {
  page: Page;
  params: URLSearchParams;
}

export type RouteParams = Record<string, string | number | null | undefined>;

function parseHash(hash: string): Route {
  const [page, query = ''] = hash.replace(/^#\/?/, '').split('?');
  return {
    page: PAGES.includes(page as Page) ? (page as Page) : 'story',
    params: new URLSearchParams(query),
  };
}

let current = parseHash(window.location.hash);
const listeners = new Set<() => void>();

window.addEventListener('hashchange', () => {
  current = parseHash(window.location.hash);
  listeners.forEach((listener) => listener());
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useRoute = () => useSyncExternalStore(subscribe, () => current);

/** Empty and null params are left out. */
export function href(page: Page, params?: RouteParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return `#/${page === 'story' ? '' : page}${query ? `?${query}` : ''}`;
}

function navigate(hash: string, replace = false) {
  if (replace) {
    window.history.replaceState(null, '', hash);
    current = parseHash(window.location.hash);
    listeners.forEach((listener) => listener());
  } else {
    window.location.hash = hash.replace(/^#/, '');
  }
}

/** Changes params of the current page without a history entry; null or '' removes one. */
export function setParams(changes: RouteParams) {
  const params: Record<string, string> = Object.fromEntries(current.params.entries());
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === '') delete params[key];
    else params[key] = String(value);
  }
  navigate(href(current.page, params), true);
}
