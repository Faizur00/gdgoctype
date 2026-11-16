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

const [getPhase, setPhase] = createSignal<PlayerPhase>("gate");
const [getPlayerName, setPlayerName] = createSignal("");

export { getPhase, setPhase, getPlayerName, setPlayerName };

export function isGateOpen(): boolean {
  return getPhase() === "gate";
}
