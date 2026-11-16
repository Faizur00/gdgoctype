// Solid's lowercase attributes (autocapitalize, spellcheck): the react rule doesn't know them
/* oxlint-disable react/no-unknown-property */
import { createSignal, JSXElement, onCleanup, onMount, Show } from "solid-js";

import {
  codePointLength,
  isValidName,
  NAME_MAX_LENGTH,
  normalizeName,
  truncateToCodePoints,
} from "../../../kiosk/name";
import { confirmPlayer, isGateOpen } from "../../../kiosk/player-state";
import { Button } from "../../common/Button";

/**
 * Name screen shown before every test (phase "gate"). While it is open the
 * test can't start (see canStartTest) and nothing steals the focus from the
 * input (see autofocusWords / focusInputElement). Keys typed inside it never
 * reach the document, so no Monkeytype hotkey can fire.
 */
export function PlayerGate(): JSXElement {
  return (
    <Show when={isGateOpen()}>
      <GateDialog />
    </Show>
  );
}

function GateDialog(): JSXElement {
  const [value, setValue] = createSignal("");
  const [error, setError] = createSignal("");
  let wrapperRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const submit = (): void => {
    const name = normalizeName(value());
    if (!isValidName(name)) {
      setError(`Isi namamu dulu (1-${NAME_MAX_LENGTH} karakter).`);
      inputRef?.focus();
      return;
    }
    void confirmPlayer(name);
  };

  onMount(() => {
    const wrapper = wrapperRef;
    if (wrapper === undefined) return;
    inputRef?.focus();

    const controller = new AbortController();
    onCleanup(() => controller.abort());
    const { signal } = controller;

    // native listeners on the wrapper: Solid's delegated handlers run on the
    // document, where stopPropagation is too late to stop other listeners
    wrapper.addEventListener(
      "keydown",
      (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && e.target === inputRef) {
          e.preventDefault();
          if (!e.isComposing) submit();
        } else if (e.key === "Tab" || e.key === "Escape") {
          e.preventDefault(); // keep the focus on the input
        }
      },
      { signal },
    );
    wrapper.addEventListener("keyup", (e) => e.stopPropagation(), { signal });
    wrapper.addEventListener("keypress", (e) => e.stopPropagation(), {
      signal,
    });
  });

  const length = (): number => codePointLength(value());

  return (
    <div
      ref={(el) => (wrapperRef = el)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="playerGateTitle"
      class="fixed inset-0 z-1000 grid place-items-center bg-bg/90 p-6 backdrop-blur-sm"
      onClick={() => inputRef?.focus()}
    >
      <div class="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl bg-bg p-8 text-center shadow-xl ring-1 ring-sub-alt">
        <img src="/images/gdgoc-logo.svg" alt="GDGoC" class="h-16 w-auto" />
        <div>
          <h2 id="playerGateTitle" class="text-3xl text-text">
            Siap adu cepat?
          </h2>
          <p class="mt-1 text-sm text-sub">
            GDGoC Unhas · Welcoming Member · Tes 20 detik
          </p>
        </div>

        <div class="flex w-full flex-col gap-2">
          <input
            ref={(el) => (inputRef = el)}
            id="playerNameInput"
            type="text"
            value={value()}
            placeholder="Namamu"
            aria-label="Nama pemain"
            aria-describedby="playerNameHint playerNameError"
            autocomplete="off"
            autocapitalize="words"
            spellcheck={false}
            class="w-full rounded-full border-2 border-sub-alt bg-bg px-5 py-3 text-center text-xl text-text outline-none placeholder:text-sub focus:border-main"
            onInput={(e) => {
              const el = e.currentTarget;
              let next = el.value;
              // limit by code points, not UTF-16 units (emoji count as one);
              // not while an IME is composing
              if (!e.isComposing && codePointLength(next) > NAME_MAX_LENGTH) {
                next = truncateToCodePoints(next, NAME_MAX_LENGTH);
                el.value = next;
              }
              setValue(next);
              setError("");
            }}
          />
          <div class="flex justify-between gap-4 px-2 text-xs text-sub">
            <span id="playerNameHint" class="text-left">
              Kalau namamu umum, tambahkan inisial/angkatan (mis. Andi R 25)
            </span>
            <span class="shrink-0">
              {length()}/{NAME_MAX_LENGTH}
            </span>
          </div>
          <p
            id="playerNameError"
            role="alert"
            class="min-h-[1.25em] text-sm text-error"
          >
            {error()}
          </p>
        </div>

        <Button
          variant="button"
          type="button"
          text="Mulai"
          class="rounded-full px-12 py-3 text-xl"
          onClick={submit}
        />
      </div>
    </div>
  );
}
