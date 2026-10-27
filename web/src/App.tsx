import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { queries, queryClient, useLive } from './api/queries';
import { Icon } from './components/Icon';
import { Skeleton } from './components/Skeleton';
import { Toasts } from './components/Toasts';
import { href, useRoute, type Page } from './lib/router';
import StoryPage from './pages/StoryPage';

const loadDataset = () => import('./pages/DatasetPage');
const loadCompare = () => import('./pages/ComparePage');
const loadExplore = () => import('./pages/ExplorePage');
const loadLive = () => import('./pages/LivePage');

const DatasetPage = lazy(loadDataset);
const ComparePage = lazy(loadCompare);
const ExplorePage = lazy(loadExplore);
const LivePage = lazy(loadLive);

const NAV: Array<{ page: Page; label: string }> = [
  { page: 'story', label: 'Story' },
  { page: 'dataset', label: 'Dataset' },
  { page: 'compare', label: 'Compare policies' },
  { page: 'explore', label: 'Explore a run' },
  { page: 'live', label: 'Live demo' },
];

const TITLES: Record<Page, string> = {
  story: 'Feedback Loop Agent',
  dataset: 'Dataset · Feedback Loop Agent',
  compare: 'Compare policies · Feedback Loop Agent',
  explore: 'Explore a run · Feedback Loop Agent',
  live: 'Live demo · Feedback Loop Agent',
};

type Theme = 'light' | 'dark';

/** The pre-paint script in index.html applies a saved theme; otherwise the OS preference wins. */
function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = document.documentElement.dataset.theme;
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  return {
    theme,
    toggle: () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch {
        // Storage blocked: the choice lasts until reload.
      }
      setTheme(next);
    },
  };
}

function PageSkeleton() {
  return (
    <div className="stack" aria-busy="true">
      <Skeleton h={14} w={120} />
      <Skeleton h={36} w="60%" />
      <Skeleton h={18} w="80%" />
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Skeleton h={300} r={10} />
        <Skeleton h={300} r={10} />
      </div>
    </div>
  );
}

/** Warms the cache for a page the pointer or focus is heading to. */
function prefetchData(page: Page) {
  if (page === 'compare') queryClient.prefetchQuery(queries.comparison());
  if (page === 'dataset') {
    queryClient.prefetchQuery(queries.datasetSummary());
    queryClient.prefetchQuery(queries.datasetDaily());
  }
  if (page === 'explore') queryClient.prefetchQuery(queries.runs());
  if (page === 'live') queryClient.prefetchQuery(queries.meta());
}

export default function App() {
  const { page } = useRoute();
  const { theme, toggle } = useTheme();
  const liveRunning = useLive().data?.active === true;
  const navRef = useRef<HTMLElement>(null);

  // Keep the current page's link visible in the scrollable nav on small screens.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (
      nav &&
      link &&
      (link.offsetLeft < nav.scrollLeft || link.offsetLeft + link.offsetWidth > nav.scrollLeft + nav.clientWidth)
    ) {
      nav.scrollTo({ left: link.offsetLeft - 8, behavior: 'smooth' });
    }
  }, [page]);

  useEffect(() => {
    document.title = TITLES[page];
    window.scrollTo({ top: 0 });
  }, [page]);

  // Fetch the other pages' code once the browser is idle.
  useEffect(() => {
    const whenIdle = (callback: () => void) =>
      'requestIdleCallback' in window ? window.requestIdleCallback(callback) : setTimeout(callback, 1200);
    whenIdle(() => {
      loadCompare();
      loadExplore();
      loadLive();
      loadDataset();
    });
  }, []);

  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href('story')} aria-label="Feedback Loop Agent: home">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="11" fill="none" stroke="var(--s1)" strokeWidth="4" />
              <path d="M16 5a11 11 0 0 1 11 11" fill="none" stroke="var(--s3)" strokeWidth="4" />
            </svg>
            <span className="brand-text">
              Feedback Loop Agent <small>· ML model monitoring</small>
            </span>
          </a>
          <nav className="nav" aria-label="Pages" ref={navRef}>
            {NAV.map((item) => (
              <a
                key={item.page}
                href={href(item.page)}
                aria-current={item.page === page ? 'page' : undefined}
                onMouseEnter={() => prefetchData(item.page)}
                onFocus={() => prefetchData(item.page)}
              >
                {item.label}
                {item.page === 'live' && liveRunning && (
                  <span
                    className="key-dot"
                    style={{ background: '#0ca30c', marginLeft: 6, verticalAlign: 1 }}
                    title="A live session is running"
                  />
                )}
              </a>
            ))}
          </nav>
          <button
            className="icon-btn"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title="Toggle theme"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>
      <main id="main">
        <Suspense fallback={<PageSkeleton />}>
          {page === 'story' && <StoryPage />}
          {page === 'dataset' && <DatasetPage />}
          {page === 'compare' && <ComparePage />}
          {page === 'explore' && <ExplorePage />}
          {page === 'live' && <LivePage />}
        </Suspense>
      </main>
      <Toasts />
    </>
  );
}
