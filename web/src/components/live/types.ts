import type { LiveAction } from '../../api/queries';
import type { LiveSession } from '../../api/types';

/** Which live action is in flight. */
export type Busy = LiveAction['kind'] | null;

/** Runs a live action, marking it busy until it settles; `onDone` gets the new state if a session is active. */
export type RunAction = (busy: Exclude<Busy, null>, action: LiveAction, onDone?: (state: LiveSession) => void) => void;
