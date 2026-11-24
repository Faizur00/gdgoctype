// Attempts per player (base name) on this device: at most MAX_ATTEMPTS tests.
// An attempt counts when the test STARTS (first key), so an abandoned, AFK or
// reloaded test still counts. Counts belong to a session: "coba" (practice)
// before the official test, then the official start time from event_state, so
// the official test starts from zero. Leaf module: no imports from test code.
import { createSignal } from "solid-js";

import { getEventState } from "./event-state";
import { nameKey } from "./name";

export const MAX_ATTEMPTS = 3;

const STORAGE_KEY = "gdgoc.attempts.v1";
const PRACTICE_SESSION = "coba";

type StoredAttempts = {
  session: string;
  counts: Record<string, number>;
};

function emptyAttempts(session = PRACTICE_SESSION): StoredAttempts {
  return { session, counts: {} };
}

function load(): StoredAttempts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyAttempts();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyAttempts();
    const record = parsed as Record<string, unknown>;
    const session = record["session"];
    const counts = record["counts"];
    if (typeof session !== "string" || session === "") return emptyAttempts();
    if (typeof counts !== "object" || counts === null) {
      return emptyAttempts(session);
    }
    const clean: Record<string, number> = {};
    for (const [key, value] of Object.entries(counts)) {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        clean[key] = value;
      }
    }
    return { session, counts: clean };
  } catch {
    return emptyAttempts();
  }
}

function persist(data: StoredAttempts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // keep going with the in-memory counts
  }
}

const [getStored, setStored] = createSignal<StoredAttempts>(load());

/**
 * The session the counts belong to. The state isn't known yet (first poll)
 * or can't be read: keep the last known session instead of guessing.
 */
function currentSession(): string {
  const state = getEventState();
  if (state === null) return getStored().session;
  return state.officialStartedAt ?? PRACTICE_SESSION;
}

/** Counts of the current session (a new session starts from zero). */
function currentCounts(): Record<string, number> {
  const stored = getStored();
  return stored.session === currentSession() ? stored.counts : {};
}

/** Tests started by this base name in the current session. Reactive. */
export function getAttemptCount(base: string): number {
  const key = nameKey(base);
  if (key === "") return 0;
  return currentCounts()[key] ?? 0;
}

/** Whether this base name may start another test. Reactive. */
export function hasAttemptsLeft(base: string): boolean {
  return getAttemptCount(base) < MAX_ATTEMPTS;
}

/** Called when a test starts (first key): one more attempt for this name. */
export function recordAttemptStart(base: string): void {
  const key = nameKey(base);
  if (key === "") return;
  const next: StoredAttempts = {
    session: currentSession(),
    counts: { ...currentCounts(), [key]: getAttemptCount(base) + 1 },
  };
  setStored(next);
  persist(next);
}
