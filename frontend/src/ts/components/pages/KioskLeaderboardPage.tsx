import {
  createEffect,
  createMemo,
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
import {
  isLeaderboardHidden,
  isSessionOpen,
  startEventStatePolling,
} from "../../kiosk/event-state";
import { cn } from "../../utils/cn";
import { Button } from "../common/Button";

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

  const topKey = createMemo(() => rows[0]?.name_key ?? "");

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
        if (isLeaderboardHidden()) {
          // hidden by the organizers: show nothing and don't even fetch the
          // standings. Start fresh (no animation) when it is revealed
          setRows(reconcile([]));
          setHasLoaded(false);
          return;
        }
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
    const stopEventState = startEventStatePolling();

    onCleanup(() => {
      stopEventState();
      stopped = true;
      controller?.abort();
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      for (const timer of highlightTimers) clearTimeout(timer);
      highlightTimers.clear();
    });
  });

  return (
    <div class="col-span-full mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col items-center gap-8 py-8">
      {/* the projector has no header: give the operator a way back to the test */}
      <div class="flex w-full items-center justify-between gap-4">
        <Button
          to="/"
          text="Kembali"
          fa={{ icon: "fa-chevron-left" }}
          class="px-4 py-2"
        />
        <Show when={!isSessionOpen()}>
          <div
            role="status"
            class="text-white rounded-full bg-[#ea4335] px-4 py-2 text-sm shadow"
          >
            Sesi ditutup
          </div>
        </Show>
      </div>

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
          GDGoC Unhas · Welcoming Member · Tes 1 menit
        </p>
      </header>

      <Show when={!isLeaderboardHidden()} fallback={<HiddenLeaderboard />}>
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
          <>
            <Podium
              rows={rows}
              highlighted={highlighted()}
              topKey={topKey()}
            />
            <Show when={rows.length > 3}>
              <ol class="mt-6 flex w-full flex-col gap-3">
                <For each={rows.slice(3)}>
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
          </>
        </Show>
      </Show>

      <Show when={!isLeaderboardHidden() && updatedAt()}>
        {(time) => (
          <p class="mt-auto text-sm text-sub">
            Diperbarui {time().toLocaleTimeString("id-ID")}
          </p>
        )}
      </Show>
    </div>
  );
}

function HiddenLeaderboard(): JSXElement {
  return (
    <div class="mt-8 flex flex-col items-center gap-4 text-center">
      <p class="text-6xl text-text">Leaderboard Hidden</p>
      <p class="text-2xl text-sub">Skor disembunyikan sampai pengumuman.</p>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_BASE_H = ["h-16", "h-24", "h-12"] as const;
const PODIUM_BASE_BG = [
  "bg-[#4285f4]",
  "bg-[#fbbc04]",
  "bg-[#34a853]",
] as const;
// stagger: left=0ms, right=150ms, center=300ms (most dramatic last)
const PODIUM_STAGGER_MS = [0, 300, 150] as const;

function PodiumSlot(props: {
  row: LeaderboardRow;
  highlighted: boolean;
  /** position in display (0=left/2nd, 1=center/1st, 2=right/3rd) */
  displayIndex: 0 | 1 | 2;
  topKey: string;
}): JSXElement {
  const rank = (): number => props.row.peringkat; // 1, 2, or 3
  const rankIdx = (): number => rank() - 1; // 0, 1, 2

  let cardEl: HTMLElement | undefined;

  const runAnimate = (el: HTMLElement, delay: number): void => {
    if (prefersReducedMotion()) return;
    el.animate(
      [
        { opacity: "0", transform: "translateY(80px)" },
        { opacity: "1", transform: "none" },
      ],
      {
        duration: 700,
        delay,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "both",
      },
    );
  };

  // re-trigger raise on the #1 slot whenever the leader changes
  let mounted = false;
  createEffect(() => {
    const _key = props.topKey; // subscribe to topKey changes
    if (!mounted) {
      mounted = true;
      return; // skip initial run; ref callback handles mount animation
    }
    if (rank() !== 1 || !cardEl) return;
    runAnimate(cardEl, 0);
  });

  return (
    <div class="flex min-w-0 flex-1 flex-col items-stretch gap-0">
      {/* card above the base */}
      <div
        ref={(el) => {
          cardEl = el;
          runAnimate(el, PODIUM_STAGGER_MS[props.displayIndex]);
        }}
        class={cn(
          "flex w-full flex-col items-center gap-1 rounded-2xl bg-sub-alt px-3 py-4 transition-[background-color,box-shadow] duration-700",
          { "bg-main/15 ring-4 ring-main": props.highlighted },
        )}
      >
        <span
          class={rank() === 1 ? "text-5xl" : "text-4xl"}
          aria-label={`Peringkat ${rank()}`}
        >
          {MEDALS[rankIdx()]}
        </span>
        <span class="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-lg font-medium text-text">
          {props.row.name}
        </span>
        <span
          class={cn(
            "font-mono text-main",
            rank() === 1 ? "text-3xl" : "text-2xl",
          )}
        >
          {props.row.wpm.toFixed(2)}
        </span>
        <span class="text-sm text-sub">{props.row.accuracy.toFixed(1)}%</span>
      </div>
      {/* podium base */}
      <div
        class={cn(
          "w-full rounded-t-lg",
          PODIUM_BASE_H[props.displayIndex],
          PODIUM_BASE_BG[props.displayIndex],
        )}
      />
    </div>
  );
}

/** Renders up to 3 rows as an Olympic podium: 2nd | 1st | 3rd. */
function Podium(props: {
  rows: LeaderboardRow[];
  highlighted: ReadonlySet<string>;
  topKey: string;
}): JSXElement {
  // Direct indexing avoids SolidJS For+static-array reactivity quirks
  const slot = (rankIndex: number, displayIndex: 0 | 1 | 2) => (
    <Show when={props.rows[rankIndex]}>
      {(row) => (
        <PodiumSlot
          row={row()}
          highlighted={props.highlighted.has(row().name_key)}
          displayIndex={displayIndex}
          topKey={props.topKey}
        />
      )}
    </Show>
  );

  return (
    <div class="flex w-full items-end justify-center gap-3">
      {slot(1, 0)}
      {slot(0, 1)}
      {slot(2, 2)}
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
