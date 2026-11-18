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
      class="group/logo -m-2 flex shrink-0 box-content flex-col gap-0.5 rounded-[0.8rem] p-2"
      aria-label="GDGoC Type Home"
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
            "hidden text-[1.75rem] font-bold leading-none text-text transition-colors duration-250 whitespace-nowrap sm:block",
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
          "hidden text-[0.68rem] leading-tight text-sub transition-colors duration-125 whitespace-nowrap group-focus-visible/logo:text-transparent sm:block",
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
