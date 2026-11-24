import {
  fetchMatchingNameKeys,
  insertScore,
  type ScoreInput,
  waitRandomJitter,
} from "./api";
import { pickSmallestFreeName } from "./name";
import { getPlayerBase, getPlayerName, setPlayerName } from "./phase";

const STORAGE_KEY = "gdgoc.scoreQueue.v1";
const MAX_QUEUE = 200;
const FLUSH_INTERVAL_MS = 15_000;
// total time to resolve a name (jitter + lookup), then the score stays queued
const RESOLVE_TIMEOUT_MS = 8_000;

export type SendOutcome = "sent" | "queued" | "closed" | "rejected";

export type QueuedScore = ScoreInput & {
  queuedAt: number;
  baseName?: string;
};

function isQueuedScore(value: unknown): value is QueuedScore {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["id"] === "string" &&
    typeof item["name"] === "string" &&
    typeof item["wpm"] === "number" &&
    typeof item["accuracy"] === "number" &&
    typeof item["queuedAt"] === "number" &&
    (item["baseName"] === undefined || typeof item["baseName"] === "string")
  );
}

function load(): QueuedScore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQueuedScore) : [];
  } catch {
    return [];
  }
}

// in-memory copy is the source of truth, localStorage is best effort
// (it can throw: private window, blocked site data, quota)
let queue: QueuedScore[] = load();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // keep going with the in-memory queue
  }
}

function enqueue(score: ScoreInput, baseName?: string): QueuedScore {
  const existing = queue.find((item) => item.id === score.id);
  if (existing !== undefined) return existing;

  const item: QueuedScore = { ...score, baseName, queuedAt: Date.now() };
  queue.push(item);
  if (queue.length > MAX_QUEUE) {
    console.warn("Score queue full, dropping the oldest score");
    queue = queue.slice(queue.length - MAX_QUEUE);
  }
  persist();
  return item;
}

function remove(id: string): void {
  queue = queue.filter((item) => item.id !== id);
  persist();
}

const sentListeners = new Set<(id: string) => void>();

/** Called whenever a queued score is confirmed stored. Returns the unsubscribe. */
export function onScoreSent(listener: (id: string) => void): () => void {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
}

const resolvedListeners = new Set<(id: string, assignedName: string) => void>();

/** Called when a queued score has its assigned name resolved. Returns the unsubscribe. */
export function onScoreResolved(
  listener: (id: string, assignedName: string) => void,
): () => void {
  resolvedListeners.add(listener);
  return () => resolvedListeners.delete(listener);
}

const closedListeners = new Set<(id: string) => void>();

/** Called when the database refused a queued score because the session is closed. */
export function onScoreClosed(listener: (id: string) => void): () => void {
  closedListeners.add(listener);
  return () => closedListeners.delete(listener);
}

const inFlight = new Map<string, Promise<SendOutcome>>();

// name resolution runs one at a time on this device: a second test finished
// while the first is still resolving/queued waits for it and reuses its name
let nameLock: Promise<unknown> = Promise.resolve();

/**
 * Name this score is sent with, or null if it can't be resolved now (offline).
 * The picked name is reserved on the device right away (not after the insert),
 * so every later test of the same base reuses it.
 */
async function resolveName(item: QueuedScore): Promise<string | null> {
  const run = nameLock.then(async (): Promise<string | null> => {
    const controller = new AbortController();
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // total deadline: a stalled lookup must not hold nameLock forever
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        expired = true;
        controller.abort();
        resolve(null);
      }, RESOLVE_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        pickName(item, controller.signal, () => expired),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  });
  nameLock = run.catch(() => undefined);
  return run;
}

async function pickName(
  item: QueuedScore,
  signal: AbortSignal,
  isExpired: () => boolean,
): Promise<string | null> {
  const currentBase = getPlayerBase();
  const sameBase = item.baseName === undefined || item.baseName === currentBase;
  const assigned = getPlayerName();
  if (assigned !== "" && sameBase) {
    if (item.name !== assigned) {
      item.name = assigned;
      persist();
    }
    return assigned;
  }

  const base = item.baseName ?? item.name;
  try {
    // jitter BEFORE the lookup: devices that finish together read different
    // snapshots instead of all seeing the same free slot
    await waitRandomJitter(100, 400);
    if (isExpired()) return null;
    const existingKeys = await fetchMatchingNameKeys(base, signal);
    // late result after the deadline: touch nothing (item, device, storage)
    if (isExpired()) return null;
    const picked = pickSmallestFreeName(base, existingKeys);
    // never overwrite the stored name with an empty result
    if (picked === "") return item.name !== "" ? item.name : null;
    item.name = picked;
    persist();
    // the base may have changed during the awaits above (next player):
    // re-check now, don't reuse the stale sameBase
    if (getPlayerBase() === item.baseName) setPlayerName(picked);
    return picked;
  } catch {
    return null;
  }
}

async function send(item: QueuedScore): Promise<SendOutcome> {
  const running = inFlight.get(item.id);
  if (running !== undefined) return running;

  const promise = (async (): Promise<SendOutcome> => {
    const nameToSend = await resolveName(item);
    // lookup failed (offline): stay queued, nothing was sent
    if (nameToSend === null) return "queued";

    const result = await insertScore({
      id: item.id,
      name: nameToSend,
      wpm: item.wpm,
      accuracy: item.accuracy,
    });

    if (result === "ok") {
      remove(item.id);
      for (const listener of resolvedListeners) listener(item.id, nameToSend);
      for (const listener of sentListeners) listener(item.id);
      return "sent";
    }
    if (result === "closed") {
      // too late: the session is closed, the score will never be accepted
      remove(item.id);
      for (const listener of closedListeners) listener(item.id);
      return "closed";
    }
    if (result === "rejected") {
      console.warn("Score rejected, dropped from the queue", item.id);
      remove(item.id);
      return "rejected";
    }
    return "queued";
  })().finally(() => inFlight.delete(item.id));

  inFlight.set(item.id, promise);
  return promise;
}

/**
 * Saves the score to the queue first (so a closed tab or a crash can't lose
 * it), then tries to send it. "queued" = will be retried by the flusher.
 */
export async function submitScore(
  score: ScoreInput,
  baseName?: string,
): Promise<SendOutcome> {
  return send(enqueue(score, baseName));
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const item of [...queue]) {
      const outcome = await send(item);
      if (outcome === "queued") break; // offline: stop, don't hammer
    }
  } finally {
    flushing = false;
  }
}

export function getPendingCount(): number {
  return queue.length;
}

let flusherStarted = false;

/**
 * Retries now, when the browser comes back online, and every 15 s. Safe to
 * call twice. Only start it on the test page, not on /leaderboard.
 */
export function startQueueFlusher(): () => void {
  if (flusherStarted) return () => undefined;
  flusherStarted = true;

  const flush = (): void => void flushQueue();
  window.addEventListener("online", flush);
  const timer = setInterval(flush, FLUSH_INTERVAL_MS);
  flush();

  return () => {
    flusherStarted = false;
    window.removeEventListener("online", flush);
    clearInterval(timer);
  };
}
