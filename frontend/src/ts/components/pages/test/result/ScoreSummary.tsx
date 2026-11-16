import { createSignal, JSXElement, onCleanup, onMount, Show } from "solid-js";

import {
  getPhase,
  nextPlayer,
  retrySameName,
} from "../../../../kiosk/player-state";
import {
  getScoreView,
  type InvalidScoreView,
  type SendStatus,
  type ValidScoreView,
} from "../../../../kiosk/score-flow";
import { Button } from "../../../common/Button";

const COUNTDOWN_SECONDS = 10;

const statusText: Record<SendStatus, string> = {
  sending: "Mengirim skor…",
  sent: "Skor terkirim ✓",
  queued: "Tersimpan offline, akan dikirim ulang",
  failed: "Skor gagal disimpan",
};

export function ScoreSummary(): JSXElement {
  const valid = (): ValidScoreView | undefined => {
    const view = getScoreView();
    return view?.kind === "valid" ? view : undefined;
  };
  const invalid = (): InvalidScoreView | undefined => {
    const view = getScoreView();
    return view?.kind === "invalid" ? view : undefined;
  };

  return (
    <>
      <Show when={valid()}>
        {(view) => <ValidScore view={view()} />}
      </Show>
      <Show when={invalid()}>{(view) => <InvalidScore view={view()} />}</Show>
    </>
  );
}

const cardClass =
  "mx-auto mb-6 flex w-full max-w-xl flex-col items-center gap-3 rounded-3xl bg-sub-alt p-6 text-center";

function ValidScore(props: { view: ValidScoreView }): JSXElement {
  const [left, setLeft] = createSignal(COUNTDOWN_SECONDS);
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
  };

  const next = (): void => {
    stop();
    nextPlayer();
  };

  onMount(() => {
    timer = setInterval(() => {
      // the screen was left some other way (hotkey): don't fire a second time
      if (getPhase() !== "result") {
        stop();
        return;
      }
      const remaining = left() - 1;
      setLeft(remaining);
      if (remaining <= 0) next();
    }, 1000);
  });
  onCleanup(stop);

  const rankText = (): string => {
    const { rank, rankLoading, status } = props.view;
    if (rank !== null) return `Peringkat #${rank.peringkat} dari ${rank.total}`;
    if (rankLoading || status === "sending") return "Peringkat…";
    return "Peringkat —";
  };

  return (
    <div class={cardClass} data-ui-element="scoreSummary">
      <p class="text-lg text-sub">{props.view.name}</p>
      <div class="leading-none">
        <span class="text-8xl text-main">{Math.round(props.view.wpm)}</span>
        <span class="ml-2 text-xl text-sub">poin (WPM)</span>
      </div>
      <p class="text-xl text-text">
        Akurasi {props.view.accuracy.toFixed(1)}%
      </p>
      <p class="text-2xl text-text">{rankText()}</p>
      <p class="text-sm text-sub">{statusText[props.view.status]}</p>
      <div class="mt-2 flex flex-col items-center gap-2">
        <Button
          variant="button"
          type="button"
          text="Pemain berikutnya"
          class="rounded-full px-8 py-3 text-lg"
          onClick={next}
        />
        <p class="text-sm text-sub">
          Otomatis berpindah dalam {left()} detik
        </p>
      </div>
    </div>
  );
}

function InvalidScore(props: { view: InvalidScoreView }): JSXElement {
  return (
    <div class={cardClass} data-ui-element="scoreSummary">
      <p class="text-lg text-sub">{props.view.name}</p>
      <p class="text-2xl text-error">Tes tidak valid</p>
      <p class="text-text">{props.view.reason}</p>
      <p class="text-sm text-sub">Skor tidak dikirim.</p>
      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <Button
          variant="button"
          type="button"
          text="Coba lagi"
          class="rounded-full px-8 py-3 text-lg"
          onClick={retrySameName}
        />
        <Button
          variant="button"
          type="button"
          text="Pemain berikutnya"
          class="rounded-full px-8 py-3 text-lg"
          onClick={nextPlayer}
        />
      </div>
    </div>
  );
}
