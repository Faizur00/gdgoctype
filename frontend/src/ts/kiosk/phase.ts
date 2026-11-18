// Leaf module (imports nothing from the test code): low-level test modules
// read the phase from here, so they don't form an import cycle with
// player-state.ts (which imports test-logic).
import { createSignal } from "solid-js";

/**
 * gate: waiting for a player name (the test can't start)
 * playing: a name is set, the test can start
 * result: the result of a finished test is shown
 */
export type PlayerPhase = "gate" | "playing" | "result";

const BASE_STORAGE_KEY = "gdgoc.playerBase.v1";
const NAME_STORAGE_KEY = "gdgoc.playerName.v1";

function loadStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function loadBase(): string {
  const base = loadStorage(BASE_STORAGE_KEY);
  if (base !== "") return base;
  return loadStorage(NAME_STORAGE_KEY);
}

function loadName(): string {
  return loadStorage(NAME_STORAGE_KEY);
}

const [getPhase, setPhase] = createSignal<PlayerPhase>("gate");
const [getPlayerBase, setPlayerBaseSignal] = createSignal(loadBase());
const [getPlayerName, setPlayerNameSignal] = createSignal(loadName());

export function setPlayerBase(base: string): void {
  setPlayerBaseSignal(base);
  try {
    if (base === "") localStorage.removeItem(BASE_STORAGE_KEY);
    else localStorage.setItem(BASE_STORAGE_KEY, base);
  } catch {
    // keep going with the in-memory state
  }
}

export function setPlayerName(name: string): void {
  setPlayerNameSignal(name);
  try {
    if (name === "") localStorage.removeItem(NAME_STORAGE_KEY);
    else localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // keep going with the in-memory state
  }
}

export { getPhase, setPhase, getPlayerBase, getPlayerName };

export function isGateOpen(): boolean {
  return getPhase() === "gate";
}
