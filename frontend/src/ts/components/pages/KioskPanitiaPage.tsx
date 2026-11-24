// Solid's lowercase attributes (inputmode, autocapitalize): the react rule doesn't know them
/* oxlint-disable react/no-unknown-property */
import {
  createSignal,
  JSXElement,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  untrack,
} from "solid-js";

import { type PanitiaAction, panitiaAction } from "../../kiosk/api";
import {
  getEventState,
  refreshEventState,
  startEventStatePolling,
} from "../../kiosk/event-state";
import { cn } from "../../utils/cn";
import { Button } from "../common/Button";

// sessionStorage, not localStorage: the PIN is gone when the tab is closed
const PIN_STORAGE_KEY = "gdgoc.panitiaPin.v1";

const NETWORK_ERROR = "Gagal terhubung. Cek koneksi lalu coba lagi.";
// a timeout on a write: it may have run in the database or not
const UNKNOWN_OUTCOME =
  "Tidak ada respons dari server. Cek status leaderboard di atas sebelum mengulang.";

function loadPin(): string {
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePin(pin: string): void {
  try {
    if (pin === "") sessionStorage.removeItem(PIN_STORAGE_KEY);
    else sessionStorage.setItem(PIN_STORAGE_KEY, pin);
  } catch {
    // keep going with the in-memory PIN
  }
}

/** Indonesian text for a non-"ok" RPC result. */
function resultText(result: string): string {
  switch (result) {
    case "wrong_pin":
      return "PIN salah";
    case "locked":
      return "Terlalu banyak percobaan, tunggu 5 menit";
    case "not_configured":
      return "PIN panitia belum diatur di database";
    case "bad_action":
      return "Aksi tidak dikenal oleh server";
    case "already_started":
      return "Tes resmi sudah dimulai sebelumnya. Skor tidak dihapus.";
    default:
      return `Respons tidak dikenal: ${result}`;
  }
}

// big colored buttons: override the themable button colors
const bigButtonClass =
  "w-full rounded-2xl px-6 py-5 text-xl [--themable-button-hover-bg:var(--text-color)] [--themable-button-hover-text:var(--bg-color)] [--themable-button-text:#ffffff]";
const redClass = "[--themable-button-bg:#ea4335]";
const greenClass = "[--themable-button-bg:#34a853]";

/**
 * Organizer page (/panitia), opened from a phone. No link points here. The
 * PIN is only checked by the database (panitia_action RPC); this page keeps
 * it in sessionStorage for the open tab. The score queue flusher is not
 * started here (only the test page starts it).
 */
export function KioskPanitiaPage(): JSXElement {
  const [pin, setPin] = createSignal(loadPin());
  // message shown on the PIN screen after being sent back (eg. wrong PIN)
  const [pinNotice, setPinNotice] = createSignal("");

  onMount(() => {
    const stop = startEventStatePolling();
    onCleanup(stop);
  });

  const logout = (notice: string): void => {
    savePin("");
    setPinNotice(notice);
    setPin("");
  };

  return (
    <div class="col-span-full mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header class="flex flex-col items-center gap-2 text-center">
        <img src="/images/gdgoc-logo.svg" alt="GDGoC" class="h-12 w-auto" />
        <h1 class="text-3xl text-text">Panel Panitia</h1>
      </header>

      <Show
        when={pin() !== ""}
        fallback={
          <PinScreen
            notice={pinNotice()}
            onSuccess={(value) => {
              savePin(value);
              setPinNotice("");
              setPin(value);
            }}
          />
        }
      >
        <ActionScreen
          pin={pin()}
          onWrongPin={() => logout(resultText("wrong_pin"))}
          onLogout={() => logout("")}
        />
      </Show>
    </div>
  );
}

function PinScreen(props: {
  notice: string;
  onSuccess: (pin: string) => void;
}): JSXElement {
  const [value, setValue] = createSignal("");
  const [error, setError] = createSignal(untrack(() => props.notice));
  const [busy, setBusy] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  onMount(() => inputRef?.focus());

  const submit = async (): Promise<void> => {
    if (busy()) return;
    const pin = value().trim();
    if (pin === "") {
      setError("Isi PIN dulu.");
      inputRef?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await panitiaAction(pin, "check");
      if (result === "ok") {
        props.onSuccess(pin);
        return;
      }
      setError(resultText(result));
      setValue("");
      inputRef?.focus();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      class="flex flex-col gap-4 rounded-3xl bg-sub-alt p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label for="panitiaPinInput" class="text-center text-lg text-text">
        Masukkan PIN panitia
      </label>
      <input
        ref={(el) => (inputRef = el)}
        id="panitiaPinInput"
        type="password"
        inputmode="numeric"
        autocomplete="off"
        autocapitalize="off"
        value={value()}
        aria-describedby="panitiaPinError"
        class="w-full rounded-full border-2 border-sub bg-bg px-5 py-4 text-center text-2xl tracking-widest text-text outline-none focus:border-main"
        onInput={(e) => {
          setValue(e.currentTarget.value);
          setError("");
        }}
      />
      <p
        id="panitiaPinError"
        role="alert"
        class="min-h-[1.25em] text-center text-error"
      >
        {error()}
      </p>
      <Button
        variant="button"
        type="submit"
        text={busy() ? "Memeriksa…" : "Masuk"}
        disabled={busy()}
        class="rounded-full py-4 text-xl"
      />
    </form>
  );
}

type Message = { kind: "ok" | "error"; text: string };

function ActionScreen(props: {
  pin: string;
  onWrongPin: () => void;
  onLogout: () => void;
}): JSXElement {
  const [busy, setBusy] = createSignal(false);
  const [confirmOfficial, setConfirmOfficial] = createSignal(false);
  const [message, setMessage] = createSignal<Message | null>(null);

  const leaderboardStatus = (): string => {
    const state = getEventState();
    if (state === null) return "memuat…";
    return state.leaderboardHidden ? "TERSEMBUNYI" : "TAMPIL";
  };

  const run = async (action: PanitiaAction, success: string): Promise<void> => {
    if (busy()) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await panitiaAction(props.pin, action);
      if (result === "wrong_pin") {
        props.onWrongPin();
        return;
      }
      if (result === "ok") {
        setMessage({ kind: "ok", text: success });
        await refreshEventState();
      } else {
        // a refusal from the database (eg. already_started), not a network error
        setMessage({ kind: "error", text: resultText(result) });
        if (result === "already_started") await refreshEventState();
      }
    } catch {
      setMessage({ kind: "error", text: UNKNOWN_OUTCOME });
      void refreshEventState();
    } finally {
      setBusy(false);
      setConfirmOfficial(false);
    }
  };

  return (
    <div class="flex flex-col gap-5">
      <div class="rounded-2xl bg-sub-alt p-4 text-center">
        <span class="text-sub">Leaderboard: </span>
        <span
          class={cn("text-xl font-medium", {
            "text-error": getEventState()?.leaderboardHidden === true,
            "text-main": getEventState()?.leaderboardHidden === false,
          })}
        >
          {leaderboardStatus()}
        </span>
      </div>

      <Show when={message()}>
        {(msg) => (
          <p
            role="status"
            class={cn("rounded-2xl p-4 text-center text-lg", {
              "bg-main/15 text-text": msg().kind === "ok",
              "bg-error/15 text-error": msg().kind === "error",
            })}
          >
            {msg().text}
          </p>
        )}
      </Show>

      {/* one button at a time, picked from the current state: no state yet
      means no button (never guess which action is safe) */}
      <Switch fallback={<p class="text-center text-sub">Memuat status…</p>}>
        <Match when={getEventState()?.leaderboardHidden === false}>
          <p class="text-center text-sm text-sub">
            Sesi coba sedang berjalan. Tekan saat tes resmi akan dimulai.
          </p>
          <Show
            when={confirmOfficial()}
            fallback={
              <Button
                variant="button"
                type="button"
                text="Tutup & mulai tes resmi"
                disabled={busy()}
                class={cn(bigButtonClass, redClass)}
                onClick={() => {
                  setMessage(null);
                  setConfirmOfficial(true);
                }}
              />
            }
          >
            <div
              role="alertdialog"
              aria-labelledby="officialConfirmText"
              class="flex flex-col gap-4 rounded-2xl bg-sub-alt p-4 ring-2 ring-error"
            >
              <p id="officialConfirmText" class="text-center text-lg text-text">
                Ini akan MENGHAPUS semua skor latihan dan menyembunyikan
                leaderboard. Lanjutkan?
              </p>
              <div class="flex gap-3">
                <Button
                  variant="button"
                  type="button"
                  text={busy() ? "Memproses…" : "Ya, hapus & mulai"}
                  disabled={busy()}
                  class={cn(bigButtonClass, redClass, "flex-1 py-4 text-lg")}
                  onClick={() =>
                    void run(
                      "start_official",
                      "Skor latihan dihapus dan leaderboard disembunyikan. Tes resmi dimulai.",
                    )
                  }
                />
                <Button
                  variant="button"
                  type="button"
                  text="Batal"
                  disabled={busy()}
                  class="flex-1 rounded-2xl py-4 text-lg"
                  onClick={() => setConfirmOfficial(false)}
                />
              </div>
            </div>
          </Show>
        </Match>
        <Match when={getEventState()?.leaderboardHidden === true}>
          <p class="text-center text-sm text-sub">
            Tes resmi sedang berjalan. Leaderboard disembunyikan.
          </p>
          <Button
            variant="button"
            type="button"
            text="Buka & umumkan hasil"
            disabled={busy()}
            class={cn(bigButtonClass, greenClass)}
            onClick={() =>
              void run("show", "Hasil diumumkan, leaderboard tampil.")
            }
          />
        </Match>
      </Switch>

      <div class="flex justify-center">
        <Button
          variant="text"
          type="button"
          text="Keluar"
          disabled={busy()}
          class="text-sm"
          onClick={() => props.onLogout()}
        />
      </div>
    </div>
  );
}
