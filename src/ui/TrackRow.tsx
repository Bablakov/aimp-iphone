import { fmtTime } from "../core/format";
import { currentTrackId, playing } from "../core/player";
import type { Track } from "../core/types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

export const TRACK_ROW_H = 60;

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

export function TrackRow({ track, onPlay, onMenu, subtitle, number }: Props) {
  const active = currentTrackId.value === track.id;
  const live = active && playing.value;
  return (
    <div class={`row track ${active ? "active" : ""}`}>
      <button class="row-main" onClick={onPlay}>
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
      <button class="icon-btn" onClick={onMenu} aria-label="Действия с треком">
        <Icon name="more" />
      </button>
    </div>
  );
}
