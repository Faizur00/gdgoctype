import { JSXElement, Show } from "solid-js";

import { isSessionOpen } from "../../../kiosk/event-state";

/**
 * Shown over everything once the organizers closed the session. The database
 * refuses scores by then; canStartTest also refuses new tests.
 */
export function SessionClosed(): JSXElement {
  return (
    <Show when={!isSessionOpen()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sessionClosedTitle"
        class="fixed inset-0 z-1100 grid place-items-center bg-bg/95 p-6 backdrop-blur-sm"
      >
        <div class="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl bg-bg p-8 text-center shadow-xl ring-1 ring-sub-alt">
          <img src="/images/gdgoc-logo.svg" alt="GDGoC" class="h-16 w-auto" />
          <h2 id="sessionClosedTitle" class="text-3xl text-text">
            Sesi sudah ditutup
          </h2>
          <p class="text-lg text-sub">
            Terima kasih sudah bermain! Pantau pengumuman pemenang.
          </p>
        </div>
      </div>
    </Show>
  );
}
