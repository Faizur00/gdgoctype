import { JSXElement } from "solid-js";

import { isFocusMode } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";

// kiosk: only the keyboard test button (/leaderboard is opened by URL). It
// only navigates, it never restarts the test (attempt limit per player)
export function Nav(): JSXElement {
  const buttonClass = () =>
    cn("aspect-square", {
      "opacity-(--nav-focus-opacity)": isFocusMode(),
    });

  return (
    <nav class="z-5 flex shrink-0 items-center gap-1 md:gap-2">
      <Button
        variant="text"
        fa={{
          icon: "fa-keyboard",
          fixedWidth: true,
        }}
        to="/"
        class={buttonClass()}
        dataset={{
          "data-nav-item": "test",
        }}
        balloon={{
          text: "Tes Mengetik",
          position: "down",
        }}
      />
    </nav>
  );
}
