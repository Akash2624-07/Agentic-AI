import {
  QueryClient,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError, request } from './client';
import type {
  Comparison,
  DailyRow,
  DatasetRowsPage,
  DatasetSummary,
  DecisionRow,
  LiveState,
  Meta,
  RegistryEvent,
  RunInfo,
  Signals,
  WeekDetail,
} from './types';

const runPath = (runId: string) => `/runs/${encodeURIComponent(runId)}`;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300_000,
      gcTime: 1_800_000,
      // Client errors won't fix themselves; retry everything else twice.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const isLiveRun = (runId: string | null) => !!runId && runId.startsWith('live:');

// A live session's data changes every time it is stepped.
const runStaleTime = (runId: string | null) => (isLiveRun(runId) ? 0 : 300_000);

export const queries = {
  meta: () =>
    queryOptions({
      queryKey: ['meta'],
      queryFn: () => request<Meta>('GET', '/meta'),
      staleTime: Infinity,
    }),
  runs: () =>
    queryOptions({
      queryKey: ['runs'],
      queryFn: () => request<RunInfo[]>('GET', '/runs'),
      staleTime: 30_000,
    }),
  comparison: () =>
    queryOptions({
      queryKey: ['comparison'],
      queryFn: () => request<Comparison>('GET', '/comparison'),
      staleTime: 60_000,
    }),
  signals: (runId: string | null) =>
    queryOptions({
      queryKey: ['signals', runId],
      queryFn: () => request<Signals>('GET', `${runPath(runId!)}/signals`),
      enabled: !!runId,
      staleTime: runStaleTime(runId),
    }),
  decisions: (runId: string | null) =>
    queryOptions({
      queryKey: ['decisions', runId],
      queryFn: () => request<DecisionRow[]>('GET', `${runPath(runId!)}/decisions`),
      enabled: !!runId,
      staleTime: runStaleTime(runId),
    }),
  events: (runId: string | null) =>
    queryOptions({
      queryKey: ['events', runId],
      queryFn: () => request<RegistryEvent[]>('GET', `${runPath(runId!)}/events`),
      enabled: !!runId,
      staleTime: runStaleTime(runId),
    }),
  week: (runId: string | null, week: number | null) =>
    queryOptions({
      queryKey: ['week', runId, week],
      queryFn: () => request<WeekDetail>('GET', `${runPath(runId!)}/weeks/${week}`),
      enabled: !!runId && week !== null,
      staleTime: runStaleTime(runId),
    }),
  datasetSummary: () =>
    queryOptions({
      queryKey: ['dataset', 'summary'],
      queryFn: () => request<DatasetSummary>('GET', '/dataset/summary'),
      staleTime: Infinity,
    }),
  datasetDaily: () =>
    queryOptions({
      queryKey: ['dataset', 'daily'],
      queryFn: () => request<DailyRow[]>('GET', '/dataset/daily'),
      staleTime: Infinity,
    }),
};

export const useMeta = () => useQuery(queries.meta());
export const useRuns = () => useQuery(queries.runs());
export const useComparison = () => useQuery(queries.comparison());
export const useSignals = (runId: string | null) => useQuery(queries.signals(runId));
export const useDecisions = (runId: string | null) => useQuery(queries.decisions(runId));
export const useEvents = (runId: string | null) => useQuery(queries.events(runId));
export const useWeek = (runId: string | null, week: number | null) => useQuery(queries.week(runId, week));
export const useDatasetSummary = () => useQuery(queries.datasetSummary());
export const useDatasetDaily = () => useQuery(queries.datasetDaily());

export interface RowQuery {
  offset: number;
  limit: number;
  split?: string;
  week?: number;
  fault_only?: boolean;
  sort?: string;
  desc?: boolean;
}

function rowSearch(query: RowQuery) {
  const params = new URLSearchParams({ offset: String(query.offset), limit: String(query.limit) });
  if (query.split) params.set('split', query.split);
  if (query.week !== undefined) params.set('week', String(query.week));
  if (query.fault_only) params.set('fault_only', 'true');
  if (query.sort) params.set('sort', query.sort);
  if (query.sort && query.desc) params.set('desc', 'true');
  return params.toString();
}

export const useDatasetRows = (query: RowQuery) =>
  useQuery({
    queryKey: ['dataset', 'rows', query],
    queryFn: () => request<DatasetRowsPage>('GET', `/dataset/rows?${rowSearch(query)}`),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

export const useLive = () =>
  useQuery({
    queryKey: ['live'],
    queryFn: () => request<LiveState>('GET', '/live'),
    staleTime: 0,
  });

export type LiveAction =
  | { kind: 'start'; policy: string; start_week: number }
  | { kind: 'resolve'; approved: boolean; note: string }
  | { kind: 'step' }
  | { kind: 'run' }
  | { kind: 'stop' };

/** Every live action returns the new session state. */
export function useLiveAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: LiveAction) => {
      switch (action.kind) {
        case 'start':
          return request<LiveState>('POST', '/live/start', {
            policy: action.policy,
            start_week: action.start_week,
          });
        case 'resolve':
          return request<LiveState>('POST', '/live/resolve', {
            approved: action.approved,
            note: action.note,
          });
        default:
          return request<LiveState>('POST', `/live/${action.kind}`);
      }
    },
    onSuccess: (state) => {
      client.setQueryData(['live'], state);
      client.invalidateQueries({ queryKey: ['runs'] });
      // Signals, decisions, events and weeks of any live run.
      client.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[1] === 'string' && query.queryKey[1].startsWith('live:'),
      });
    },
    onError: () => {
      client.invalidateQueries({ queryKey: ['live'] });
    },
  });
}
