import { JSXElement, Show } from "solid-js";

import { isLeaderboardHidden } from "../../../../kiosk/event-state";
import { changeName, retrySameName } from "../../../../kiosk/player-state";
import {
  getScoreView,
  type InvalidScoreView,
  type SendStatus,
  type ValidScoreView,
} from "../../../../kiosk/score-flow";
import { Button } from "../../../common/Button";

const statusText: Record<SendStatus, string> = {
  sending: "Mengirim skor…",
  sent: "Skor terkirim ✓",
  queued: "Tersimpan offline, akan dikirim ulang",
  closed: "Sesi sudah ditutup, skor tidak tersimpan",
  failed: "Skor gagal disimpan",
};

const cardClass =
  "mx-auto mb-6 flex w-full max-w-xl flex-col items-center gap-3 rounded-3xl bg-sub-alt p-6 text-center";

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
      <Show when={valid()}>{(view) => <ValidScore view={view()} />}</Show>
      <Show when={invalid()}>{(view) => <InvalidScore view={view()} />}</Show>
    </>
  );
}

function ValidScore(props: { view: ValidScoreView }): JSXElement {
  const rankText = (): string => {
    // the organizers hide the standings near the end: don't leak the rank
    return "Peringkat nya liat diatas aja bg";
  };

  const bestText = (): string | undefined => {
    if (isLeaderboardHidden()) return undefined;
    const best = props.view.rank?.bestWpm;
    return best === null || best === undefined
      ? undefined
      : `Skor terbaikmu ${best.toFixed(2)}`;
  };

  return (
    <div class={cardClass} data-ui-element="scoreSummary">
      <p class="text-lg text-sub">{props.view.name}</p>
      <div class="leading-none">
        <span class="text-8xl text-main">{Math.round(props.view.wpm)}</span>
        <span class="ml-2 text-xl text-sub">poin (WPM)</span>
      </div>
      <p class="text-xl text-text">Akurasi {props.view.accuracy.toFixed(1)}%</p>
      <p class="text-2xl text-text">{rankText()}</p>
      <Show when={bestText()}>
        {(text) => <p class="text-lg text-sub">{text()}</p>}
      </Show>
      <p class="text-sm text-sub">{statusText[props.view.status]}</p>
      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <Button
          variant="button"
          type="button"
          text="Main lagi"
          class="rounded-full px-8 py-3 text-lg"
          onClick={retrySameName}
        />
        <Button
          variant="text"
          type="button"
          text="Ganti nama"
          class="rounded-full px-6 py-3 text-lg"
          onClick={changeName}
        />
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
          variant="text"
          type="button"
          text="Ganti nama"
          class="rounded-full px-6 py-3 text-lg"
          onClick={changeName}
        />
      </div>
    </div>
  );
}
