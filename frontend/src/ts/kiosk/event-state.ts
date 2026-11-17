// Session state controlled by the organizers in Supabase (table event_state):
// open / closed, leaderboard hidden, optional end time. The database is the
// real lock (the INSERT policy on scores checks it); this module only lets the
// UI follow it. Leaf module: no imports from the test code.
import { createSignal } from "solid-js";

import { isDevEnvironment } from "../utils/env";
import { type EventState, fetchEventState } from "./api";

const POLL_MS = 5000;

// dev only (pnpm dev-fe): ?event=closed or ?event=hidden forces the state so
// the UI can be built without touching the database. Read once at load, before
// the router rewrites the url. Never active in a production build.
const initialSearch = window.location.search;

function devOverride(): EventState | null {
  if (!isDevEnvironment()) return null;
  const event = new URLSearchParams(initialSearch).get("event");
  if (event === "closed") {
    return { open: false, leaderboardHidden: false, endsAt: null };
  }
  if (event === "hidden") {
    return { open: true, leaderboardHidden: true, endsAt: null };
  }
  return null;
}

const [getEventState, setEventState] = createSignal<EventState | null>(null);

export { getEventState };

/**
 * false once the organizers closed the session (or its end time passed).
 * Fails open: no data yet or an unreachable table means "open" (the database
 * still rejects scores when the session is really closed).
 */
export function isSessionOpen(): boolean {
  const state = getEventState();
  if (state === null) return true;
  if (!state.open) return false;
  if (state.endsAt !== null && Date.now() >= state.endsAt.getTime()) {
    return false;
  }
  return true;
}

/** The end time of the session, if the organizers set one. */
export function getSessionEndsAt(): Date | null {
  return getEventState()?.endsAt ?? null;
}

/** true while the organizers hide the leaderboard (last minute, before the reveal). */
export function isLeaderboardHidden(): boolean {
  return getEventState()?.leaderboardHidden ?? false;
}

/**
 * Polls the state every 5 s, one request at a time. Keeps the last state when
 * a poll fails. Returns the stop function.
 */
export function startEventStatePolling(): () => void {
  const forced = devOverride();
  if (forced !== null) {
    setEventState(forced);
    return () => undefined;
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const poll = async (): Promise<void> => {
    controller = new AbortController();
    try {
      const state = await fetchEventState(controller.signal);
      if (!stopped && state !== null) setEventState(state);
    } catch {
      // keep the last known state
    } finally {
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    }
  };
  void poll();

  return () => {
    stopped = true;
    controller?.abort();
    if (timer !== undefined) clearTimeout(timer);
  };
}
