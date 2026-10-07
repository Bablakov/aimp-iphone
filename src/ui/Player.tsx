import { useEffect, useRef, useState } from "preact/hooks";
import { fmtTime } from "../core/format";
import * as E from "../core/eq";
import * as P from "../core/player";
import { trackMap, UNKNOWN_ARTIST } from "../core/store";
import { trackMenu } from "./actions";
import { Cover } from "./Cover";
import { openSheet } from "./dialogs";
import { Icon } from "./Icon";
import { closeLayer, openLayer } from "./nav";
import { TRACK_ROW_H } from "./TrackRow";
import { VirtualList } from "./VirtualList";

// ───────── мини-плеер ─────────

export function MiniPlayer() {
  const t = P.currentTrack.value;
  if (!t) return null;
  const pct = P.duration.value > 0 ? Math.min(100, (P.time.value / P.duration.value) * 100) : 0;
  return (
    <div class="mini" role="region" aria-label="Плеер">
      <div class="mini-progress" style={{ width: `${pct}%` }} />
      <button class="mini-main" onClick={() => openLayer({ type: "player" })}>
        <div class="thumb">
          <Cover id={t.coverId} seed={t.album || t.artist || t.title} />
        </div>
        <div class="meta">
          <div class="title">{t.title}</div>
          <div class="sub">{t.artist || UNKNOWN_ARTIST}</div>
        </div>
      </button>
      <button class="icon-btn" onClick={P.togglePlay} aria-label={P.playing.value ? "Пауза" : "Играть"}>
        <Icon name={P.playing.value ? "pause" : "play"} size={28} />
      </button>
      <button class="icon-btn" onClick={P.next} aria-label="Следующий">
        <Icon name="next" size={26} />
      </button>
    </div>
  );
}

// ───────── ползунок перемотки ─────────

function Seek() {
  const [drag, setDrag] = useState<number | null>(null);
  const d = P.duration.value;
  const value = drag ?? P.time.value;
  const pct = d > 0 ? Math.min(100, (value / d) * 100) : 0;
  return (
    <div class="seek">
      <input
        type="range"
        min={0}
        max={d || 1}
        step={0.1}
        value={value}
        style={{ "--p": `${pct}%` }}
        aria-label="Позиция"
        onInput={(e) => setDrag(Number((e.currentTarget as HTMLInputElement).value))}
        onChange={(e) => {
          P.seek(Number((e.currentTarget as HTMLInputElement).value));
          setDrag(null);
        }}
      />
      <div class="times">
        <span>{fmtTime(value)}</span>
        <span>-{fmtTime(Math.max(0, d - value))}</span>
      </div>
    </div>
  );
}

// ───────── таймер сна ─────────

function useSleepLabel(): string | null {
  const s = P.sleep.value;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!s || !("at" in s)) return;
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [s]);
  if (!s) return null;
  if ("endOfTrack" in s) return "до конца трека";
  return `${Math.max(1, Math.ceil((s.at - Date.now()) / 60_000))} мин`;
}

function pickSleep(): void {
  const active = P.sleep.value != null;
  openSheet({
    title: "Таймер сна",
    items: [
      ...(active ? [{ label: "Выключить таймер", icon: "close" as const, onSelect: P.clearSleep }] : []),
      ...[5, 15, 30, 45, 60, 90].map((m) => ({ label: `Через ${m} мин`, icon: "moon" as const, onSelect: () => P.setSleepMinutes(m) })),
      { label: "После этого трека", icon: "moon" as const, onSelect: P.setSleepEndOfTrack },
    ],
  });
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
function pickRate(): void {
  openSheet({
    title: "Скорость",
    items: RATES.map((r) => ({ label: r === 1 ? "Обычная (1×)" : `${r}×`, checked: P.rate.value === r, onSelect: () => P.setRate(r) })),
  });
}

// ───────── «Сейчас играет» ─────────

export function NowPlaying() {
  const t = P.currentTrack.value;
  const sleepLabel = useSleepLabel();
  // Трек исчез (удалён или очередь очищена) — закрываем экран.
  const gone = !t;
  useEffect(() => {
    if (gone) closeLayer();
  }, [gone]);
  if (!t) return null;
  const rep = P.repeat.value;
  return (
    <div class="layer full player">
      <header class="top">
        <div class="top-side">
          <button class="icon-btn" onClick={closeLayer} aria-label="Свернуть">
            <Icon name="down" />
          </button>
        </div>
        <div class="top-title">
          <div class="top-sub">Сейчас играет</div>
        </div>
        <div class="top-side right">
          <button class="icon-btn" onClick={() => trackMenu(t)} aria-label="Действия с треком">
            <Icon name="more" />
          </button>
        </div>
      </header>

      <div class="np-body">
        <div class="np-cover">
          <Cover id={t.coverId} seed={t.album || t.artist || t.title} />
        </div>
        <div class="np-info">
          <div class="np-title">{t.title}</div>
          <div class="np-artist">{[t.artist || UNKNOWN_ARTIST, t.album].filter(Boolean).join(" — ")}</div>
        </div>
        <Seek />
        <div class="controls">
          <button class={`icon-btn ${P.shuffleOn.value ? "on" : ""}`} onClick={P.toggleShuffle} aria-label="Перемешать" aria-pressed={P.shuffleOn.value}>
            <Icon name="shuffle" />
          </button>
          <button class="icon-btn big" onClick={P.prev} aria-label="Предыдущий">
            <Icon name="prev" size={34} />
          </button>
          <button class="play-btn" onClick={P.togglePlay} aria-label={P.playing.value ? "Пауза" : "Играть"}>
            <Icon name={P.playing.value ? "pause" : "play"} size={38} />
          </button>
          <button class="icon-btn big" onClick={P.next} aria-label="Следующий">
            <Icon name="next" size={34} />
          </button>
          <button class={`icon-btn ${rep !== "off" ? "on" : ""}`} onClick={P.cycleRepeat} aria-label="Повтор">
            <Icon name={rep === "one" ? "repeat1" : "repeat"} />
          </button>
        </div>
        <div class="extras">
          <button class={`chip-btn ${P.rate.value !== 1 ? "on" : ""}`} onClick={pickRate}>
            <Icon name="speed" size={20} />
            <span>{P.rate.value}×</span>
          </button>
          <button class={`chip-btn ${E.eq.value.enabled ? "on" : ""}`} onClick={() => openLayer({ type: "eq" })}>
            <Icon name="eq" size={20} />
            <span>Эквалайзер</span>
          </button>
          <button class={`chip-btn ${sleepLabel ? "on" : ""}`} onClick={pickSleep}>
            <Icon name="moon" size={20} />
            <span>{sleepLabel ?? "Сон"}</span>
          </button>
          <button class="chip-btn" onClick={() => openLayer({ type: "queue" })}>
            <Icon name="queue" size={20} />
            <span>Очередь</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── очередь ─────────

export function QueueLayer() {
  const q = P.queue.value;
  return (
    <div class="layer full">
      <header class="top">
        <div class="top-side">
          <button class="icon-btn" onClick={closeLayer} aria-label="Назад">
            <Icon name="back" />
          </button>
        </div>
        <div class="top-title">
          <h1>Очередь</h1>
          <div class="top-sub">{q.order.length ? `${q.pos + 1} из ${q.order.length}` : ""}</div>
        </div>
        <div class="top-side right">
          {q.order.length > 0 && (
            <button
              class="icon-btn"
              aria-label="Очистить очередь"
              onClick={() => {
                P.clearQueue();
                closeLayer();
              }}
            >
              <Icon name="trash" />
            </button>
          )}
        </div>
      </header>
      <VirtualList
        count={q.order.length}
        rowHeight={TRACK_ROW_H}
        initialIndex={q.pos}
        empty={
          <div class="empty">
            <h2>Очередь пуста</h2>
          </div>
        }
        row={(i) => <QueueRow index={i} />}
      />
    </div>
  );
}

function QueueRow({ index }: { index: number }) {
  const q = P.queue.value;
  const t = trackMap.value.get(q.order[index]);
  if (!t) return null;
  const active = index === q.pos;
  return (
    <div class={`row track ${active ? "active" : ""}`}>
      <button class="row-main" onClick={() => P.jumpTo(index)}>
        <div class="thumb">
          <Cover id={t.coverId} seed={t.album || t.artist || t.title} />
        </div>
        <div class="meta">
          <div class="title">{t.title}</div>
          <div class="sub">{t.artist || UNKNOWN_ARTIST}</div>
        </div>
        <div class="dur">{t.duration ? fmtTime(t.duration) : ""}</div>
      </button>
      <button class="icon-btn" onClick={() => P.removeFromQueue(index)} aria-label="Убрать из очереди">
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

// ───────── эквалайзер ─────────

/** Вертикальный ползунок на pointer events: родной range на iOS вертикально ведёт себя нестабильно. */
function VSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const p = 1 - (clientY - r.top) / r.height;
    onChange(-E.EQ_RANGE + 2 * E.EQ_RANGE * Math.min(1, Math.max(0, p)));
  };
  const pos = ((value + E.EQ_RANGE) / (2 * E.EQ_RANGE)) * 100;
  return (
    <div
      class="vslider"
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={-E.EQ_RANGE}
      aria-valuemax={E.EQ_RANGE}
      aria-valuenow={value}
      onPointerDown={(e) => {
        ref.current!.setPointerCapture(e.pointerId);
        set(e.clientY);
      }}
      onPointerMove={(e) => {
        if (ref.current!.hasPointerCapture(e.pointerId)) set(e.clientY);
      }}
    >
      <div class="vs-line" />
      <div class="vs-fill" style={value >= 0 ? { bottom: "50%", height: `${pos - 50}%` } : { top: "50%", height: `${50 - pos}%` }} />
      <div class="vs-thumb" style={{ bottom: `${pos}%` }} />
    </div>
  );
}

const fmtFreq = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

export function EqLayer() {
  const st = E.eq.value;
  return (
    <div class="layer full">
      <header class="top">
        <div class="top-side">
          <button class="icon-btn" onClick={closeLayer} aria-label="Назад">
            <Icon name="back" />
          </button>
        </div>
        <div class="top-title">
          <h1>Эквалайзер</h1>
        </div>
        <div class="top-side right">
          <label class="switch">
            <input type="checkbox" checked={st.enabled} disabled={!E.eqSupported} onChange={(e) => E.setEnabled((e.currentTarget as HTMLInputElement).checked, P.audio)} />
            <span />
          </label>
        </div>
      </header>
      <div class="scroll pad">
        {!E.eqSupported && <p class="note">Этот браузер не поддерживает Web Audio — эквалайзер недоступен.</p>}
        <div class="chips">
          {Object.keys(E.EQ_PRESETS).map((name) => (
            <button key={name} class={`chip ${st.preset === name ? "on" : ""}`} onClick={() => E.applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>

        <div class={`eq-panel ${st.enabled ? "" : "off"}`}>
          <div class="eq-bands">
            {E.EQ_FREQS.map((f, i) => (
              <div class="eq-band" key={f}>
                <div class="eq-db">{st.gains[i] > 0 ? `+${st.gains[i]}` : st.gains[i]}</div>
                <VSlider value={st.gains[i]} onChange={(v) => E.setBand(i, v)} label={`${f} Гц`} />
                <div class="eq-hz">{fmtFreq(f)}</div>
              </div>
            ))}
          </div>
          <div class="preamp">
            <span>Предусиление</span>
            <input
              type="range"
              min={-E.EQ_RANGE}
              max={E.EQ_RANGE}
              step={0.5}
              value={st.preamp}
              style={{ "--p": `${((st.preamp + E.EQ_RANGE) / (2 * E.EQ_RANGE)) * 100}%` }}
              onInput={(e) => E.setPreamp(Number((e.currentTarget as HTMLInputElement).value))}
              aria-label="Предусиление"
            />
            <b>{st.preamp > 0 ? `+${st.preamp}` : st.preamp} дБ</b>
          </div>
        </div>

        <p class="note">
          Включённый эквалайзер пропускает звук через Web Audio. Если после включения пропал звук при выключенном экране — выключите эквалайзер и перезапустите приложение.
        </p>
      </div>
    </div>
  );
}
