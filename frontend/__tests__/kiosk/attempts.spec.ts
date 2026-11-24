import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventState } from "../../src/ts/kiosk/api";

// the event state is a signal fed by polling Supabase: replace it with a
// plain variable the tests control
let eventState: EventState | null = null;
vi.mock("../../src/ts/kiosk/event-state", () => ({
  getEventState: () => eventState,
}));

const STORAGE_KEY = "gdgoc.attempts.v1";

function state(officialStartedAt: string | null): EventState {
  return {
    open: true,
    leaderboardHidden: false,
    endsAt: null,
    officialStartedAt,
  };
}

// fresh module per test: it reads localStorage once, at import
async function loadAttempts(): Promise<
  typeof import("../../src/ts/kiosk/attempts")
> {
  vi.resetModules();
  return import("../../src/ts/kiosk/attempts");
}

describe("kiosk attempts", () => {
  beforeEach(() => {
    localStorage.clear();
    eventState = state(null);
  });

  it("allows MAX_ATTEMPTS starts per base name, then refuses", async () => {
    const a = await loadAttempts();
    expect(a.MAX_ATTEMPTS).toBe(3);
    expect(a.getAttemptCount("Andi")).toBe(0);
    for (let i = 1; i <= 3; i++) {
      expect(a.hasAttemptsLeft("Andi")).toBe(true);
      a.recordAttemptStart("Andi");
      expect(a.getAttemptCount("Andi")).toBe(i);
    }
    expect(a.hasAttemptsLeft("Andi")).toBe(false);
  });

  it("counts by name key (case and spaces don't matter)", async () => {
    const a = await loadAttempts();
    a.recordAttemptStart("Andi R");
    a.recordAttemptStart("  andi r ");
    expect(a.getAttemptCount("ANDI R")).toBe(2);
    expect(a.getAttemptCount("Budi")).toBe(0);
  });

  it("ignores an empty name", async () => {
    const a = await loadAttempts();
    a.recordAttemptStart("");
    expect(a.getAttemptCount("")).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("survives a reload (localStorage)", async () => {
    const first = await loadAttempts();
    first.recordAttemptStart("Andi");
    first.recordAttemptStart("Andi");

    const reloaded = await loadAttempts();
    expect(reloaded.getAttemptCount("Andi")).toBe(2);
  });

  it("starts from zero when the official test starts", async () => {
    const a = await loadAttempts();
    for (let i = 0; i < 3; i++) a.recordAttemptStart("Andi");
    expect(a.hasAttemptsLeft("Andi")).toBe(false);

    eventState = state("2026-11-24T10:00:00Z");
    const official = await loadAttempts();
    expect(official.getAttemptCount("Andi")).toBe(0);
    official.recordAttemptStart("Andi");
    expect(official.getAttemptCount("Andi")).toBe(1);
  });

  it("keeps the last known session while the state is unknown", async () => {
    eventState = state("2026-11-24T10:00:00Z");
    const a = await loadAttempts();
    a.recordAttemptStart("Andi");

    // first poll not done yet, or Supabase unreachable
    eventState = null;
    const reloaded = await loadAttempts();
    expect(reloaded.getAttemptCount("Andi")).toBe(1);
    reloaded.recordAttemptStart("Andi");
    expect(reloaded.getAttemptCount("Andi")).toBe(2);

    // once known again, still the same official session
    eventState = state("2026-11-24T10:00:00Z");
    expect(reloaded.getAttemptCount("Andi")).toBe(2);
  });

  it("treats corrupt storage as empty", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const a = await loadAttempts();
    expect(a.getAttemptCount("Andi")).toBe(0);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ session: "coba", counts: { andi: "3", budi: -1 } }),
    );
    const b = await loadAttempts();
    expect(b.getAttemptCount("Andi")).toBe(0);
    expect(b.getAttemptCount("Budi")).toBe(0);
  });
});
