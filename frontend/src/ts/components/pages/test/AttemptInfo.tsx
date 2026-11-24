import { JSXElement, Show } from "solid-js";

import { getAttemptCount, MAX_ATTEMPTS } from "../../../kiosk/attempts";
import { getPhase, getPlayerBase } from "../../../kiosk/phase";
import { isTestActive } from "../../../states/test";

/**
 * Kiosk: "Andi · Percobaan 2 dari 3" above the words, before and during the
 * test. Before the first key it shows the attempt about to start; once the
 * test started (the attempt is counted) it shows the current one.
 */
export function AttemptInfo(): JSXElement {
  const attemptNumber = (): number =>
    Math.min(
      getAttemptCount(getPlayerBase()) + (isTestActive() ? 0 : 1),
      MAX_ATTEMPTS,
    );

  return (
    <Show when={getPhase() === "playing" && getPlayerBase() !== ""}>
      <p class="mb-2 text-center text-sub" data-ui-element="kioskAttemptInfo">
        {getPlayerBase()} · Percobaan {attemptNumber()} dari {MAX_ATTEMPTS}
      </p>
    </Show>
  );
}
