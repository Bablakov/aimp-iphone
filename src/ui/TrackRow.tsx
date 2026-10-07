import { useRef } from "preact/hooks";
import { fmtTime } from "../core/format";
import { currentTrackId, playing } from "../core/player";
import type { Track } from "../core/types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { selection, startSelect, toggleSelect } from "./select";

export const TRACK_ROW_H = 60;
const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

interface Props {
  track: Track;
  onPlay: () => void;
  onMenu: () => void;
  /** Что показать во второй строке; по умолчанию исполнитель. */
  subtitle?: string;
  /** Номер вместо обложки (в альбомах). */
  number?: number;
}

function Eq() {
  return (
    <span class="bars" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span class={`checkbox ${checked ? "on" : ""}`} aria-hidden="true">
      {checked && <Icon name="check" size={16} />}
    </span>
  );
}

export function TrackRow({ track, onPlay, onMenu, subtitle, number }: Props) {
  const active = currentTrackId.value === track.id;
  const live = active && playing.value;
  const sel = selection.value;
  const selecting = sel !== null;
  const selected = sel?.has(track.id) ?? false;

  // Долгое нажатие включает режим выбора. Прокрутка отменяет pointer — таймер сбрасывается.
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (selecting) return;
    cancelPress();
    const timer = window.setTimeout(() => {
      if (press.current) press.current.fired = true;
      startSelect(track.id);
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
    press.current = { timer, x: e.clientX, y: e.clientY, fired: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) clearTimeout(p.timer);
  };
  const onClick = () => {
    // Клик после долгого нажатия — это отпускание пальца, а не выбор «играть».
    if (press.current?.fired) {
      press.current.fired = false;
      return;
    }
    if (selecting) toggleSelect(track.id);
    else onPlay();
  };

  return (
    <div class={`row track ${active ? "active" : ""} ${selected ? "selected" : ""}`}>
      <button
        class="row-main"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        {selecting && <CheckBox checked={selected} />}
        {number != null ? (
          <div class="num">{live ? <Eq /> : number || "–"}</div>
        ) : (
          <div class="thumb">
            <Cover id={track.coverId} seed={track.album || track.artist || track.title} />
            {live && (
              <div class="thumb-overlay">
                <Eq />
              </div>
            )}
          </div>
        )}
        <div class="meta">
          <div class="title">{track.title}</div>
          <div class="sub">{subtitle ?? (track.artist || "Неизвестный исполнитель")}</div>
        </div>
        <div class="dur">{track.duration ? fmtTime(track.duration) : ""}</div>
      </button>
      {!selecting && (
        <button class="icon-btn" onClick={onMenu} aria-label="Действия с треком">
          <Icon name="more" />
        </button>
      )}
    </div>
  );
}
