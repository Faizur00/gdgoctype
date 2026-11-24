import { restartTest } from "../test/test-logic";
import { focusWords } from "../test/test-ui";
import { hasAttemptsLeft } from "./attempts";
import { isValidName, normalizeName } from "./name";
import {
  getPhase,
  getPlayerBase,
  getPlayerName,
  isGateOpen,
  setPhase,
  setPlayerBase,
  setPlayerName,
} from "./phase";
import { resetLastNotifiedName } from "./score-flow";

export { getPhase, getPlayerBase, getPlayerName, isGateOpen, setPhase };
export type { PlayerPhase } from "./phase";

let confirming = false;

/**
 * Gate confirmed: stores the (normalized) base name, opens the test and focuses
 * the words, so the first key starts the test. false if the name is invalid.
 * If the base name is unchanged and an assigned name exists on this device,
 * the assigned name is kept. If the base name changes, assigned name is cleared
 * so the next insert resolves a fresh suffix.
 */
export async function confirmPlayer(rawName: string): Promise<boolean> {
  const name = normalizeName(rawName);
  if (!isValidName(name)) return false;
  // all attempts used on this device (the gate shows why)
  if (!hasAttemptsLeft(name)) return false;
  if (confirming) return true;

  confirming = true;
  try {
    const currentBase = getPlayerBase();
    if (currentBase !== name) {
      setPlayerBase(name);
      setPlayerName("");
      resetLastNotifiedName();
    } else {
      setPlayerBase(name);
    }
    setPhase("playing");
    await restartTest({ noAnim: true });
    focusWords();
  } finally {
    confirming = false;
  }
  return true;
}

/** Change the name: back to the name gate with an empty name and a fresh test. */
export function changeName(): void {
  setPlayerBase("");
  setPlayerName("");
  resetLastNotifiedName();
  setPhase("gate");
  void restartTest();
}

/**
 * Same person, next attempt: keeps the name. With no attempt left it goes to
 * the name gate for the next player instead.
 */
export function retrySameName(): void {
  if (!hasAttemptsLeft(getPlayerBase())) {
    changeName();
    return;
  }
  setPhase("playing");
  void restartTest();
}
