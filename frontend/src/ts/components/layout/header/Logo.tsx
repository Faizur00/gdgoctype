import { Link } from "@tanstack/solid-router";
import { JSXElement } from "solid-js";

import { getRoutePage } from "../../../states/router";
import { isFocusMode } from "../../../states/test";
import { restartTest } from "../../../test/test-logic";
import { cn } from "../../../utils/cn";

export function Logo(): JSXElement {
  return (
    <Link
      to="/"
      class="group/logo -m-2 flex w-max flex-col gap-1 rounded-[0.8rem] p-2"
      aria-label="GDGoC Type Home"
      style={{
        "box-sizing": "content-box",
        "font-family": "Outfit, sans-serif",
      }}
      data-ui-element="logo"
      onClick={() => {
        if (getRoutePage() === "test") void restartTest();
      }}
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
            "hidden text-[1.75rem] leading-none text-text transition-colors duration-250 sm:block",
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
          "hidden max-w-[11rem] text-[0.65rem] leading-tight text-sub transition-colors duration-125 group-focus-visible/logo:text-transparent md:block",
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
