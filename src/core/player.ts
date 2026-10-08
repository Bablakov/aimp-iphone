import { computed, signal } from "@preact/signals";
import { getBlob, kvGet, kvSet } from "./db";
import { ensureGraph } from "./eq";
import * as Q from "./queue";
import { coverUrl, showToast, trackMap } from "./store";
import type { RepeatMode } from "./types";

/**
 * Один-единственный <audio> на всё приложение. На iOS фоновое воспроизведение и кнопки на
 * экране блокировки держатся именно за живой элемент: пересоздавать его между треками нельзя.
 */
export const audio = new Audio();
audio.preload = "auto";
(audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
// При изменении скорости тон не должен «плыть» (по умолчанию так и есть, но Safari требует префикс).
audio.preservesPitch = true;
(audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;

export const queue = signal<Q.Queue>(Q.emptyQueue());
export const shuffleOn = signal(false);
export const repeat = signal<RepeatMode>("off");
export const rate = signal(1);
export const playing = signal(false);
export const time = signal(0);
export const duration = signal(0);
export const buffering = signal(false);
export type Sleep = { at: number } | { endOfTrack: true } | null;
export const sleep = signal<Sleep>(null);

export const currentTrackId = computed(() => Q.currentId(queue.value));
export const currentTrack = computed(() => {
  const id = currentTrackId.value;
  return id ? trackMap.value.get(id) : undefined;
});

// ───────── загрузка трека ─────────

let loadToken = 0;
/** Токен последней загрузки, чей src реально выставлен в <audio>. Пока он отстаёт — audio.currentTime чужой. */
let appliedToken = 0;
let currentUrl: string | null = null;
let preloaded: { id: string; url: string } | null = null;
let pendingSeek = 0;
/** true между сменой src и началом звука: паузу в этот момент не считаем остановкой пользователем. */
let switching = false;
let errorStreak = 0;

function releasePreloaded(): void {
  if (preloaded) URL.revokeObjectURL(preloaded.url);
  preloaded = null;
}

function startPlayback(): void {
  ensureGraph(audio);
  audio.play().catch((e: unknown) => {
    switching = false;
    playing.value = false;
    // NotAllowedError — запуск без жеста (например, при восстановлении сессии): не ошибка.
    if (!(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError"))) {
      console.warn("play() failed", e);
    }
  });
}

function load(id: string, autoplay: boolean, startAt = 0): void {
  const token = ++loadToken;
  pendingSeek = startAt;
  switching = autoplay;
  playing.value = autoplay;
  time.value = startAt;
  duration.value = trackMap.value.get(id)?.duration ?? 0;
  updateMediaSession();

  const apply = (url: string) => {
    if (token !== loadToken) {
      URL.revokeObjectURL(url);
      return;
    }
    const old = currentUrl;
    currentUrl = url;
    appliedToken = token;
    audio.src = url;
    audio.defaultPlaybackRate = rate.value;
    audio.playbackRate = rate.value;
    if (old) URL.revokeObjectURL(old);
    if (autoplay) startPlayback();
  };

  // Следующий трек подготовлен заранее: переключаемся синхронно, пока iOS ещё считает нас «играющими».
  if (preloaded?.id === id) {
    const url = preloaded.url;
    preloaded = null;
    apply(url);
    return;
  }
  releasePreloaded();
  getBlob(id)
    .then((blob) => {
      if (token !== loadToken) return;
      if (!blob) throw new Error("файл не найден в хранилище");
      apply(URL.createObjectURL(blob));
    })
    .catch((e) => {
      if (token !== loadToken) return;
      console.warn("load failed", id, e);
      handleBroken();
    });
}

function preloadNext(): void {
  if (repeat.value === "one") return;
  const id = Q.peekNextId(queue.value);
  if (!id || preloaded?.id === id) return;
  releasePreloaded();
  getBlob(id)
    .then((blob) => {
      if (!blob || Q.peekNextId(queue.value) !== id || preloaded) return;
      preloaded = { id, url: URL.createObjectURL(blob) };
    })
    .catch(() => {});
}

function clearAudio(): void {
  appliedToken = ++loadToken;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
  releasePreloaded();
  playing.value = false;
  switching = false;
  time.value = 0;
  duration.value = 0;
  updateMediaSession();
}

/** Нечитаемый файл: сообщаем и, если играли, переходим к следующему — но не по кругу бесконечно. */
function handleBroken(): void {
  const t = currentTrack.value;
  showToast(`Не удалось воспроизвести «${t?.title ?? "трек"}»`);
  errorStreak++;
  const wasPlaying = playing.value || switching;
  if (wasPlaying && errorStreak < Math.min(queue.value.order.length, 5)) {
    const q = Q.advance(queue.value, "off");
    if (q) {
      queue.value = q;
      load(Q.currentId(q)!, true);
      return;
    }
  }
  playing.value = false;
  switching = false;
}

// ───────── события <audio> ─────────

let lastSave = 0;
let lastPosState = 0;

audio.addEventListener("playing", () => {
  switching = false;
  buffering.value = false;
  playing.value = true;
  errorStreak = 0;
  preloadNext();
  updatePositionState();
});
audio.addEventListener("pause", () => {
  if (switching || audio.ended) return;
  playing.value = false;
  updatePositionState();
  saveState();
});
audio.addEventListener("waiting", () => (buffering.value = true));
audio.addEventListener("canplay", () => (buffering.value = false));
audio.addEventListener("loadedmetadata", () => {
  if (Number.isFinite(audio.duration)) duration.value = audio.duration;
  if (pendingSeek > 0) {
    try {
      audio.currentTime = pendingSeek;
    } catch {
      /* перемотка до готовности метаданных на некоторых версиях Safari бросает — не критично */
    }
    pendingSeek = 0;
  }
});
audio.addEventListener("durationchange", () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) duration.value = audio.duration;
});
audio.addEventListener("timeupdate", () => {
  time.value = audio.currentTime;
  const now = Date.now();
  const s = sleep.value;
  if (s && "at" in s && now >= s.at) {
    sleep.value = null;
    audio.pause();
    showToast("Таймер сна: воспроизведение остановлено");
  }
  if (now - lastPosState > 1000) {
    lastPosState = now;
    updatePositionState();
  }
  if (now - lastSave > 5000) saveState();
});
audio.addEventListener("ratechange", () => {
  // Таймкод при смене скорости не должен «подтягиваться» к устаревшему значению.
  time.value = audio.currentTime;
  updatePositionState();
});
audio.addEventListener("seeked", updatePositionState);
audio.addEventListener("error", () => {
  if (audio.getAttribute("src")) handleBroken();
});
audio.addEventListener("ended", onEnded);

function onEnded(): void {
  const s = sleep.value;
  if (s && "endOfTrack" in s) {
    sleep.value = null;
    stopAtStart();
    showToast("Таймер сна: воспроизведение остановлено");
    return;
  }
  if (repeat.value === "one") {
    audio.currentTime = 0;
    startPlayback();
    return;
  }
  const q = Q.advance(queue.value, repeat.value);
  if (!q) {
    stopAtStart();
    return;
  }
  queue.value = q;
  load(Q.currentId(q)!, true);
  saveState();
}

/** Очередь доиграна: встаём на первый трек в паузе, чтобы «играть» начинало сначала. */
function stopAtStart(): void {
  const q = Q.jump(queue.value, 0);
  queue.value = q;
  const id = Q.currentId(q);
  if (id) load(id, false);
  else playing.value = false;
  saveState();
}

// ───────── управление ─────────

export function playQueue(ids: string[], startId: string | null = null, forceShuffle?: boolean): void {
  if (ids.length === 0) return;
  if (forceShuffle !== undefined) shuffleOn.value = forceShuffle;
  const q = Q.createQueue(ids, startId, shuffleOn.value);
  queue.value = q;
  load(Q.currentId(q)!, true);
  saveState();
}

export function togglePlay(): void {
  if (!currentTrackId.value) return;
  if (!audio.getAttribute("src")) {
    // Сессия восстановлена, но звук ещё не подгружен (или очередь доиграна).
    load(currentTrackId.value, true, time.value);
    return;
  }
  if (audio.paused) {
    switching = false;
    startPlayback();
  } else audio.pause();
}

export function next(): void {
  const q = Q.advance(queue.value, repeat.value);
  if (!q) return stopAtStart();
  queue.value = q;
  load(Q.currentId(q)!, true);
  saveState();
}

export function prev(): void {
  if (audio.currentTime > 3) return seek(0);
  const q = Q.retreat(queue.value, repeat.value);
  if (q === queue.value) return seek(0);
  queue.value = q;
  load(Q.currentId(q)!, true);
  saveState();
}

export function seek(sec: number): void {
  if (!audio.getAttribute("src")) {
    pendingSeek = sec;
    time.value = sec;
    return;
  }
  const max = Number.isFinite(audio.duration) ? audio.duration : duration.value;
  audio.currentTime = Math.max(0, Math.min(sec, max || sec));
  time.value = audio.currentTime;
}

export function seekBy(delta: number): void {
  seek(audio.currentTime + delta);
}

export function toggleShuffle(): void {
  shuffleOn.value = !shuffleOn.value;
  queue.value = Q.setShuffle(queue.value, shuffleOn.value);
  preloadNextSoon();
  saveState();
}

export function cycleRepeat(): void {
  repeat.value = repeat.value === "off" ? "all" : repeat.value === "all" ? "one" : "off";
  saveState();
}

export const RATE_MIN = 0.5;
export const RATE_MAX = 2;
export const RATE_STEP = 0.05;

/** Скорость с шагом 0.05 в пределах, которые iOS играет со звуком. `persist: false` — на лету при перетаскивании. */
export function setRate(r: number, persist = true): void {
  const v = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, r)) / RATE_STEP) * RATE_STEP;
  const clean = Number(v.toFixed(2));
  rate.value = clean;
  // Каждая смена playbackRate на iOS перезапускает time-stretch и сдвигает позицию: при
  // перетаскивании ползунка десятки смен подряд дают «откаты» и скачки вперёд. Применяем
  // скорость к <audio> только после паузы в перетаскивании.
  if (rateTimer) clearTimeout(rateTimer);
  if (persist) {
    applyRate();
    saveState();
  } else rateTimer = setTimeout(applyRate, 200);
}

let rateTimer: ReturnType<typeof setTimeout> | undefined;

function applyRate(): void {
  rateTimer = undefined;
  const v = rate.value;
  if (audio.defaultPlaybackRate !== v) audio.defaultPlaybackRate = v;
  if (audio.playbackRate !== v) audio.playbackRate = v;
}

export function jumpTo(index: number): void {
  const q = Q.jump(queue.value, index);
  queue.value = q;
  load(Q.currentId(q)!, true);
  saveState();
}

export function playNext(id: string): void {
  if (!currentTrackId.value) return playQueue([id], id);
  queue.value = Q.playNext(queue.value, id);
  preloadNextSoon();
  saveState();
}

/** Несколько треков сразу «следом» — в том же порядке, в котором переданы. */
export function playNextMany(ids: string[]): void {
  if (ids.length === 0) return;
  if (!currentTrackId.value) return playQueue(ids, ids[0]);
  let q = queue.value;
  for (let i = ids.length - 1; i >= 0; i--) q = Q.playNext(q, ids[i]);
  queue.value = q;
  preloadNextSoon();
  saveState();
}

export function enqueueMany(ids: string[]): void {
  if (ids.length === 0) return;
  if (!currentTrackId.value) return playQueue(ids, ids[0]);
  queue.value = ids.reduce((q, id) => Q.enqueue(q, id), queue.value);
  saveState();
}

export function enqueue(id: string): void {
  if (!currentTrackId.value) return playQueue([id], id);
  queue.value = Q.enqueue(queue.value, id);
  saveState();
}

export function removeFromQueue(index: number): void {
  const wasCurrent = index === queue.value.pos;
  const wasPlaying = playing.value;
  const q = Q.removeAt(queue.value, index);
  queue.value = q;
  if (wasCurrent) {
    const id = Q.currentId(q);
    if (id) load(id, wasPlaying);
    else clearAudio();
  } else preloadNextSoon();
  saveState();
}

/** Трек удалён из библиотеки — убираем его из очереди и, если он играл, переходим дальше. */
export function onTracksRemoved(ids: string[]): void {
  const gone = new Set(ids);
  const cur = currentTrackId.value;
  const wasPlaying = playing.value;
  const q = Q.removeIds(queue.value, gone);
  queue.value = q;
  if (cur && gone.has(cur)) {
    const id = Q.currentId(q);
    if (id) load(id, wasPlaying);
    else clearAudio();
  } else preloadNextSoon();
  saveState();
}

export function clearQueue(): void {
  queue.value = Q.emptyQueue();
  clearAudio();
  saveState();
}

function preloadNextSoon(): void {
  releasePreloaded();
  if (playing.value) preloadNext();
}

// ───────── таймер сна ─────────

export function setSleepMinutes(min: number): void {
  sleep.value = { at: Date.now() + min * 60_000 };
}
export function setSleepEndOfTrack(): void {
  sleep.value = { endOfTrack: true };
}
export function clearSleep(): void {
  sleep.value = null;
}

// ───────── экран блокировки ─────────

function updateMediaSession(): void {
  if (!("mediaSession" in navigator)) return;
  const t = currentTrack.value;
  if (!t) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const base = { title: t.title, artist: t.artist, album: t.album };
  navigator.mediaSession.metadata = new MediaMetadata(base);
  if (t.coverId) {
    void coverUrl(t.coverId).then((url) => {
      if (url && currentTrack.value?.id === t.id) {
        navigator.mediaSession.metadata = new MediaMetadata({ ...base, artwork: [{ src: url, sizes: "512x512" }] });
      }
    });
  }
}

function updatePositionState(): void {
  if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
  const d = Number.isFinite(audio.duration) ? audio.duration : duration.value;
  if (!d || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      position: Math.min(audio.currentTime, d),
      playbackRate: audio.playbackRate || 1,
    });
  } catch {
    /* некорректные значения на границе трека — пропускаем кадр */
  }
}

function setupMediaSession(): void {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, h);
    } catch {
      /* действие не поддерживается этой версией iOS */
    }
  };
  set("play", () => togglePlay());
  set("pause", () => audio.pause());
  set("previoustrack", () => prev());
  set("nexttrack", () => next());
  set("seekbackward", (d) => seekBy(-(d.seekOffset ?? 10)));
  set("seekforward", (d) => seekBy(d.seekOffset ?? 10));
  set("seekto", (d) => {
    if (d.seekTime != null) seek(d.seekTime);
  });
  set("stop", () => audio.pause());
}

// ───────── сохранение и восстановление сессии ─────────

interface Saved {
  base: string[];
  order: string[];
  pos: number;
  shuffle: boolean;
  repeat: RepeatMode;
  rate: number;
  time: number;
}

export function saveState(): void {
  lastSave = Date.now();
  const q = queue.value;
  const s: Saved = {
    base: q.base,
    order: q.order,
    pos: q.pos,
    shuffle: shuffleOn.value,
    repeat: repeat.value,
    rate: rate.value,
    time: audio.getAttribute("src") && appliedToken === loadToken ? audio.currentTime : time.value,
  };
  void kvSet("player", s);
}

export async function initPlayer(): Promise<void> {
  setupMediaSession();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState();
  });
  window.addEventListener("pagehide", saveState);

  const s = await kvGet<Saved>("player");
  if (!s) return;
  shuffleOn.value = s.shuffle;
  repeat.value = s.repeat;
  rate.value = s.rate || 1;
  const known = trackMap.value;
  const gone = new Set([...s.order, ...s.base].filter((id) => !known.has(id)));
  const q = Q.removeIds({ base: s.base, order: s.order, pos: s.pos, shuffle: s.shuffle }, gone);
  if (q.order.length === 0) return;
  queue.value = q;
  const dur = trackMap.value.get(Q.currentId(q)!)?.duration ?? 0;
  load(Q.currentId(q)!, false, dur > 0 && s.time > dur - 2 ? 0 : s.time);
}
