import { restartTest } from "../test/test-logic";
import { focusWords } from "../test/test-ui";
import { isValidName, normalizeName } from "./name";
import {
  getPhase,
  getPlayerName,
  isGateOpen,
  setPhase,
  setPlayerName,
} from "./phase";

export { getPhase, getPlayerName, isGateOpen, setPhase };
export type { PlayerPhase } from "./phase";

let confirming = false;

/**
 * Gate confirmed: stores the (normalized) name, opens the test and focuses
 * the words, so the first key starts the test. false if the name is invalid.
 */
export async function confirmPlayer(rawName: string): Promise<boolean> {
  const name = normalizeName(rawName);
  if (!isValidName(name)) return false;
  if (confirming) return true;

  confirming = true;
  try {
    setPlayerName(name);
    setPhase("playing");
    await restartTest({ noAnim: true });
    focusWords();
  } finally {
    confirming = false;
  }
  return true;
}

/** Next person: back to the name gate with an empty name and a fresh test. */
export function nextPlayer(): void {
  setPlayerName("");
  setPhase("gate");
  void restartTest();
}

/** Same person tries again (eg. after an invalid test): keeps the name. */
export function retrySameName(): void {
  setPhase("playing");
  void restartTest();
}
