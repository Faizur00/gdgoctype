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

const NAME_STORAGE_KEY = "gdgoc.playerName.v1";

// the name is remembered on this device (everyone plays on their own laptop
// and retries with the same name). localStorage can throw: best effort
function loadName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

const [getPhase, setPhase] = createSignal<PlayerPhase>("gate");
const [getPlayerName, setPlayerNameSignal] = createSignal(loadName());

export function setPlayerName(name: string): void {
  setPlayerNameSignal(name);
  try {
    if (name === "") localStorage.removeItem(NAME_STORAGE_KEY);
    else localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // keep going with the in-memory name
  }
}

export { getPhase, setPhase, getPlayerName };

export function isGateOpen(): boolean {
  return getPhase() === "gate";
}
