import { insertScore, type ScoreInput } from "./api";

const STORAGE_KEY = "gdgoc.scoreQueue.v1";
const MAX_QUEUE = 200;
const FLUSH_INTERVAL_MS = 15_000;

export type SendOutcome = "sent" | "queued" | "rejected";

type QueuedScore = ScoreInput & { queuedAt: number };

function isQueuedScore(value: unknown): value is QueuedScore {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["id"] === "string" &&
    typeof item["name"] === "string" &&
    typeof item["wpm"] === "number" &&
    typeof item["accuracy"] === "number" &&
    typeof item["queuedAt"] === "number"
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

function enqueue(score: ScoreInput): QueuedScore {
  const existing = queue.find((item) => item.id === score.id);
  if (existing !== undefined) return existing;

  const item: QueuedScore = { ...score, queuedAt: Date.now() };
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

const inFlight = new Map<string, Promise<SendOutcome>>();

function send(item: QueuedScore): Promise<SendOutcome> {
  const running = inFlight.get(item.id);
  if (running !== undefined) return running;

  const promise = (async (): Promise<SendOutcome> => {
    const result = await insertScore(item);
    if (result === "ok") {
      remove(item.id);
      for (const listener of sentListeners) listener(item.id);
      return "sent";
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
export async function submitScore(score: ScoreInput): Promise<SendOutcome> {
  return send(enqueue(score));
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
