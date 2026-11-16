import {
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";

import { fetchTop, type LeaderboardRow } from "../../kiosk/api";
import { cn } from "../../utils/cn";

const TOP_COUNT = 10;
const POLL_MS = 2500;
const HIGHLIGHT_MS = 3500;
// show "offline" only after this many failed polls in a row (no flicker)
const OFFLINE_AFTER_FAILURES = 2;

const rankBadgeClass = [
  "bg-[#fbbc04] text-[#202124]",
  "bg-[#4285f4] text-white",
  "bg-[#34a853] text-white",
];

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Live top 10 for the second laptop / projector. Polls the leaderboard view
 * (one request at a time), keeps the last data when a poll fails, and animates
 * rank changes with FLIP (measure, update the DOM, animate from the old spot).
 */
export function KioskLeaderboardPage(): JSXElement {
  const [rows, setRows] = createStore<LeaderboardRow[]>([]);
  const [hasLoaded, setHasLoaded] = createSignal(false);
  const [isOffline, setOffline] = createSignal(false);
  const [updatedAt, setUpdatedAt] = createSignal<Date | null>(null);
  const [highlighted, setHighlighted] = createSignal<ReadonlySet<string>>(
    new Set(),
  );

  const rowElements = new Map<string, HTMLElement>();
  const registerRow = (key: string, el: HTMLElement | undefined): void => {
    if (el === undefined) rowElements.delete(key);
    else rowElements.set(key, el);
  };

  const measure = (): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>();
    for (const [key, el] of rowElements) {
      rects.set(key, el.getBoundingClientRect());
    }
    return rects;
  };

  // FLIP "play": the DOM is already in its new order, start every row at its
  // old spot and let it slide to the new one. New rows fade in.
  const play = (before: Map<string, DOMRect>): void => {
    if (prefersReducedMotion()) return;
    for (const [key, el] of rowElements) {
      const old = before.get(key);
      if (old === undefined) {
        el.animate(
          [
            { opacity: 0, transform: "translateY(24px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 500, easing: "ease-out" },
        );
        continue;
      }
      const dy = old.top - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) continue;
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
        { duration: 650, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
  };

  const highlightTimers = new Set<ReturnType<typeof setTimeout>>();

  const highlight = (keys: string[]): void => {
    if (keys.length === 0) return;
    setHighlighted((current) => new Set([...current, ...keys]));
    const timer = setTimeout(() => {
      highlightTimers.delete(timer);
      setHighlighted((current) => {
        const next = new Set(current);
        for (const key of keys) next.delete(key);
        return next;
      });
    }, HIGHLIGHT_MS);
    highlightTimers.add(timer);
  };

  const applyRows = (next: LeaderboardRow[]): void => {
    const isFirstLoad = !hasLoaded();
    const previous = new Map(
      rows.map((row) => [row.name_key, { ...row }] as const),
    );
    const before = measure();

    // new entry, better rank or better score than in the previous poll
    const changed = isFirstLoad
      ? []
      : next
          .filter((row) => {
            const old = previous.get(row.name_key);
            return (
              old === undefined ||
              row.peringkat < old.peringkat ||
              row.wpm > old.wpm
            );
          })
          .map((row) => row.name_key);

    // rows are kept by name_key, so their elements move instead of remounting
    setRows(reconcile(next, { key: "name_key" }));
    setHasLoaded(true);
    setUpdatedAt(new Date());

    if (!isFirstLoad) play(before);
    highlight(changed);
  };

  onMount(() => {
    let stopped = false;
    let failures = 0;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    // one request at a time: the next poll is scheduled when this one is done
    const poll = async (): Promise<void> => {
      controller = new AbortController();
      try {
        const data = await fetchTop(TOP_COUNT, controller.signal);
        if (stopped) return;
        failures = 0;
        setOffline(false);
        applyRows(data);
      } catch {
        if (stopped) return;
        failures++;
        if (failures >= OFFLINE_AFTER_FAILURES) setOffline(true);
      } finally {
        if (!stopped) pollTimer = setTimeout(() => void poll(), POLL_MS);
      }
    };
    void poll();

    onCleanup(() => {
      stopped = true;
      controller?.abort();
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      for (const timer of highlightTimers) clearTimeout(timer);
      highlightTimers.clear();
    });
  });

  return (
    <div class="col-span-full mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col items-center gap-8 py-8">
      <Show when={isOffline()}>
        <div
          role="status"
          class="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[#fbbc04] px-4 py-2 text-sm text-[#202124] shadow"
        >
          <span class="h-2 w-2 rounded-full bg-[#ea4335]"></span>
          offline, menampilkan data terakhir
        </div>
      </Show>

      <header class="flex flex-col items-center gap-3 text-center">
        <img src="/images/gdgoc-logo.svg" alt="GDGoC" class="h-20 w-auto" />
        <h1 class="text-5xl text-text">Leaderboard</h1>
        <p class="text-lg text-sub">
          GDGoC Unhas · Welcoming Member · Tes 20 detik
        </p>
      </header>

      <Show
        when={rows.length > 0}
        fallback={
          <p class="mt-8 text-2xl text-sub">
            {hasLoaded()
              ? "Belum ada skor. Jadilah yang pertama!"
              : "Memuat leaderboard…"}
          </p>
        }
      >
        <ol class="flex w-full flex-col gap-3">
          <For each={rows}>
            {(row) => (
              <Row
                row={row}
                highlighted={highlighted().has(row.name_key)}
                register={registerRow}
              />
            )}
          </For>
        </ol>
      </Show>

      <Show when={updatedAt()}>
        {(time) => (
          <p class="mt-auto text-sm text-sub">
            Diperbarui {time().toLocaleTimeString("id-ID")}
          </p>
        )}
      </Show>
    </div>
  );
}

function Row(props: {
  row: LeaderboardRow;
  highlighted: boolean;
  register: (key: string, el: HTMLElement | undefined) => void;
}): JSXElement {
  // rows are keyed by name_key: it never changes for this element
  const key = untrack(() => props.row.name_key);
  const badge = (): string =>
    rankBadgeClass[props.row.peringkat - 1] ?? "bg-sub-alt text-sub";

  return (
    <li
      ref={(el) => {
        props.register(key, el);
        onCleanup(() => props.register(key, undefined));
      }}
      class={cn(
        "grid grid-cols-[4.5rem_1fr_9rem_8rem] items-center gap-4 rounded-3xl bg-sub-alt px-6 py-4 transition-[background-color,box-shadow] duration-700",
        { "bg-main/15 ring-4 ring-main": props.highlighted },
      )}
    >
      <span
        class={cn(
          "grid h-14 w-14 place-items-center rounded-full text-3xl",
          badge(),
        )}
      >
        {props.row.peringkat}
      </span>
      <span class="truncate text-3xl text-text">{props.row.name}</span>
      <span class="text-right text-4xl text-main">
        {props.row.wpm.toFixed(2)}
      </span>
      <span class="text-right text-xl text-sub">
        {props.row.accuracy.toFixed(1)}%
      </span>
    </li>
  );
}
