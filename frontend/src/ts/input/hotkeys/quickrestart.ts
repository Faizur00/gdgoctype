import { createRoot } from "solid-js";

import { hotkeys, quickRestartHotkeyMap } from "../../states/hotkeys";
import { createHotkey } from "./utils";
import { getConfig } from "../../config/store";
import { isLongTest, wordsHaveNewline, wordsHaveTab } from "../../states/test";

// kiosk: no restart from the keyboard, neither mid test nor on the result
// screen. The only way to the next test is the kiosk buttons (attempt limit).
// quickRestart is also locked to "off" (no key); this is the second guard.
function quickRestart(e: KeyboardEvent): void {
  e.preventDefault();
}

// Disable restartTest when we're in long test and quick restartTest key is enter, because `shift + enter, shift +
// enter` is already reserved for bail out keybind.
createRoot(() =>
  createHotkey(
    () => hotkeys.quickRestart,
    quickRestart,
    () => ({
      enabled: !isLongTest() || getConfig.quickRestart !== "enter",
      conflictBehavior: "allow",
    }),
  ),
);

// We also want to have a hotkey for quick restartTest key without shift, so when the
// test is considered long (which means that we can't quick restart), we show a
// notification when the user tries to press the quick restartTest key without shift,
// and we'll restartTest when it's pressed with shift.
createRoot(() =>
  createHotkey(
    () => quickRestartHotkeyMap[getConfig.quickRestart],
    quickRestart,
    () => ({
      enabled:
        isLongTest() &&
        !(wordsHaveTab() && getConfig.quickRestart === "tab") &&
        !(wordsHaveNewline() && getConfig.quickRestart === "enter"),
      conflictBehavior: "allow",
    }),
  ),
);
