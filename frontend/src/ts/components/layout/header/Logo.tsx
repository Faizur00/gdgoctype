import { Link } from "@tanstack/solid-router";
import { JSXElement } from "solid-js";

import { isFocusMode } from "../../../states/test";
import { cn } from "../../../utils/cn";

// kiosk: the logo only navigates home. It never restarts the test (attempt
// limit per player: the next test only comes from the kiosk buttons)

export function Logo(): JSXElement {
  return (
    <Link
      to="/"
      class="group/logo -m-2 box-content flex shrink-0 flex-col gap-0.5 rounded-[0.8rem] p-2"
      aria-label="GDGoC Type Home"
      data-ui-element="logo"
    >
      <div class="flex h-9 items-center gap-2">
        <img
          src="/images/gdgoc-logo.svg"
          alt="GDGoC"
          class={cn("h-full w-auto transition-opacity", {
            "opacity-50": isFocusMode(),
          })}
        />
        <h1
          class={cn(
            "hidden text-[1.75rem] leading-none font-bold whitespace-nowrap text-text transition-colors duration-250 sm:block",
            {
              "text-sub": isFocusMode(),
            },
          )}
          data-ui-element="logoText"
        >
          Type
        </h1>
      </div>
      <div
        class={cn(
          "hidden text-[0.68rem] leading-tight whitespace-nowrap text-sub transition-colors duration-125 group-focus-visible/logo:text-transparent sm:block",
          {
            "text-transparent": isFocusMode(),
          },
        )}
        data-ui-element="logoSubtext"
      >
        GDGoC Unhas · Welcoming Member
      </div>
    </Link>
  );
}
