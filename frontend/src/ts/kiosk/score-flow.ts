// What the result screen shows for the finished test, and the score submit.
// Leaf module: it must not import test-logic (test-logic calls reportFinishedTest).
import { createSignal } from "solid-js";

import { showNoticeNotification } from "../states/notifications";
import { fetchRank, type RankInfo } from "./api";
import { getPlayerBase, getPlayerName, setPhase } from "./phase";
import {
  onScoreClosed,
  onScoreResolved,
  onScoreSent,
  submitScore,
} from "./score-queue";

export type SendStatus = "sending" | "sent" | "queued" | "closed" | "failed";

export type ValidScoreView = {
  kind: "valid";
  id: string;
  name: string;
  wpm: number;
  accuracy: number;
  status: SendStatus;
  rank: RankInfo | null;
  rankLoading: boolean;
};

export type InvalidScoreView = {
  kind: "invalid";
  name: string;
  reason: string;
};

export type ScoreView = ValidScoreView | InvalidScoreView;

const [getScoreView, setScoreView] = createSignal<ScoreView | null>(null);

export { getScoreView };

let lastNotifiedName = "";

export function resetLastNotifiedName(): void {
  lastNotifiedName = "";
}

function updateValid(
  id: string,
  patch: Partial<Omit<ValidScoreView, "kind" | "id">>,
): void {
  setScoreView((view) =>
    view?.kind === "valid" && view.id === id
      ? { ...view, ...patch }
      : view,
  );
}

async function loadRank(id: string, name: string): Promise<void> {
  updateValid(id, { rankLoading: true });
  let rank: RankInfo | null = null;
  try {
    rank = await fetchRank(name);
  } catch {
    rank = null; // shown as "—"
  }
  // ignored if the screen already moved on to another test
  updateValid(id, { rank, rankLoading: false });
}

// when an assigned name is resolved (eg. first test or on offline queue flush)
onScoreResolved((id, assignedName) => {
  const view = getScoreView();
  if (view?.kind === "valid" && view.id === id) {
    updateValid(id, { name: assignedName });
  }

  const base = getPlayerBase();
  if (
    base !== "" &&
    assignedName !== base &&
    lastNotifiedName !== assignedName
  ) {
    lastNotifiedName = assignedName;
    showNoticeNotification(
      `Nama "${base}" sudah dipakai peserta lain. Namamu disesuaikan menjadi "${assignedName}".`,
      {
        customTitle: "Nama Disesuaikan",
        customIcon: "user-tag",
        durationMs: 6000,
      },
    );
  }
});

// a score is confirmed stored (right away, or later by the offline queue)
onScoreSent((id) => {
  const view = getScoreView();
  if (view?.kind !== "valid" || view.id !== id) return;
  updateValid(id, { status: "sent" });
  void loadRank(id, view.name);
});

// a queued score was refused later because the session closed
onScoreClosed((id) => updateValid(id, { status: "closed" }));

/**
 * Called by finish() once the test is over. invalidReason: why Monkeytype
 * marked the test invalid (null = valid, the score is submitted).
 */
export function reportFinishedTest(result: {
  wpm: number;
  accuracy: number;
  invalidReason: string | null;
}): void {
  const base = getPlayerBase();
  const assigned = getPlayerName();
  const nameToUse = assigned !== "" ? assigned : base;
  setPhase("result");

  if (result.invalidReason !== null) {
    setScoreView({ kind: "invalid", name: nameToUse, reason: result.invalidReason });
    return;
  }
  if (nameToUse === "") {
    setScoreView({
      kind: "invalid",
      name: nameToUse,
      reason: "nama pemain belum diisi",
    });
    return;
  }

  const id = crypto.randomUUID();
  setScoreView({
    kind: "valid",
    id,
    name: nameToUse,
    wpm: result.wpm,
    accuracy: result.accuracy,
    status: "sending",
    rank: null,
    rankLoading: false,
  });

  // "sent" and "resolved" are handled by the listeners above
  void submitScore(
    {
      id,
      name: nameToUse,
      wpm: result.wpm,
      accuracy: result.accuracy,
    },
    base,
  ).then((outcome) => {
    if (outcome === "queued") updateValid(id, { status: "queued" });
    else if (outcome === "closed") updateValid(id, { status: "closed" });
    else if (outcome === "rejected") updateValid(id, { status: "failed" });
  });
}
