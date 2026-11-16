import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "../constants/supabase";
import { isValidName, nameKey, normalizeName } from "./name";

const REST_URL = `${SUPABASE_URL}/rest/v1`;
const DEFAULT_TIMEOUT_MS = 4000;

export type ScoreInput = {
  id: string;
  name: string;
  wpm: number;
  accuracy: number;
};

/** ok: stored (201, or 409 = same id already stored). retry: try again later. rejected: will never work. */
export type InsertResult = "ok" | "retry" | "rejected";

export type LeaderboardRow = {
  peringkat: number;
  name: string;
  name_key: string;
  wpm: number;
  accuracy: number;
  created_at: string;
};

export type RankInfo = { peringkat: number; total: number };

type RequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

async function request(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const onAbort = (): void => controller.abort();
  // an already aborted signal never fires "abort" again: abort right away
  if (options.signal?.aborted === true) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", onAbort, { once: true });
  }

  try {
    // only the apikey header: no Authorization (publishable keys are not JWTs)
    return await fetch(`${REST_URL}${path}`, {
      method: options.method ?? "GET",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, ...options.headers },
      body: options.body,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function insertScore(score: ScoreInput): Promise<InsertResult> {
  const body = {
    id: score.id,
    name: normalizeName(score.name),
    wpm: round2(score.wpm),
    accuracy: round2(score.accuracy),
  };

  // same limits as the DB constraints: don't send what is sure to be a 400
  if (
    !isValidName(body.name) ||
    !Number.isFinite(body.wpm) ||
    body.wpm < 0 ||
    body.wpm > 350 ||
    !Number.isFinite(body.accuracy) ||
    body.accuracy < 0 ||
    body.accuracy > 100
  ) {
    return "rejected";
  }

  let response: Response;
  try {
    response = await request("/scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return "retry"; // network error or timeout
  }

  if (response.status === 201 || response.status === 409) return "ok";
  // 401/403 are retried too (a fixed key/policy must not lose queued scores)
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 408 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    return "retry";
  }
  return "rejected"; // 400 etc: constraint violation, retrying is pointless
}

/** PostgREST returns numeric columns as numbers or strings: accept both. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRow(value: unknown): LeaderboardRow | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;

  const peringkat = toNumber(row["peringkat"]);
  const wpm = toNumber(row["wpm"]);
  const accuracy = toNumber(row["accuracy"]);
  const name = row["name"];
  const key = row["name_key"];
  const createdAt = row["created_at"];

  if (
    peringkat === null ||
    wpm === null ||
    accuracy === null ||
    typeof name !== "string" ||
    typeof key !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return {
    peringkat,
    name,
    name_key: key,
    wpm,
    accuracy,
    created_at: createdAt,
  };
}

/** Throws on network error, timeout, abort or a bad response. */
export async function fetchTop(
  limit = 10,
  signal?: AbortSignal,
): Promise<LeaderboardRow[]> {
  const query =
    "select=peringkat,name,name_key,wpm,accuracy,created_at" +
    `&order=peringkat.asc,created_at.asc&limit=${limit}`;
  const response = await request(`/leaderboard?${query}`, { signal });
  if (!response.ok) throw new Error(`leaderboard ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("leaderboard: unexpected body");
  return data
    .map(parseRow)
    .filter((row): row is LeaderboardRow => row !== null);
}

/**
 * Rank of `name` (best score per name) and the number of rows in the view.
 * null if the name isn't in the view. Throws on network errors.
 */
export async function fetchRank(
  name: string,
  signal?: AbortSignal,
): Promise<RankInfo | null> {
  const key = encodeURIComponent(nameKey(name));
  const [rankResponse, countResponse] = await Promise.all([
    request(`/leaderboard?name_key=eq.${key}&select=peringkat&limit=1`, {
      signal,
    }),
    request("/leaderboard?select=peringkat&limit=1", {
      headers: { Prefer: "count=exact" },
      signal,
    }),
  ]);
  if (!rankResponse.ok) throw new Error(`rank ${rankResponse.status}`);
  if (!countResponse.ok) throw new Error(`count ${countResponse.status}`);

  const rows: unknown = await rankResponse.json();
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
  const peringkat =
    typeof first === "object" && first !== null
      ? toNumber((first as Record<string, unknown>)["peringkat"])
      : null;
  if (peringkat === null) return null;

  // Content-Range looks like "0-0/42" (or "*/0")
  const match = /\/(\d+)$/.exec(
    countResponse.headers.get("content-range") ?? "",
  );
  if (match === null) return null;
  return { peringkat, total: Number(match[1]) };
}
