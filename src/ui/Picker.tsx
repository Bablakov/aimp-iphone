import { useMemo, useState } from "preact/hooks";
import { fmtTime, plural } from "../core/format";
import { addToPlaylist, byTrackNo, playlists, showToast, tracks } from "../core/store";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { closeLayer } from "./nav";
import { CheckBox, TRACK_ROW_H } from "./TrackRow";
import { VirtualList } from "./VirtualList";

/** Выбор нескольких треков из всей библиотеки для добавления в плейлист. */
export function PickerLayer({ playlistId }: { playlistId: string }) {
  const pl = playlists.value.find((p) => p.id === playlistId);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const inPlaylist = useMemo(() => new Set(pl?.trackIds), [pl]);

  // Порядок «исполнитель → альбом → номер»: так удобно добавлять целые альбомы подряд.
  const all = useMemo(() => {
    const c = (a: string, b: string) => a.localeCompare(b, "ru");
    return tracks.value.slice().sort((a, b) => c(a.artist, b.artist) || c(a.album, b.album) || byTrackNo(a, b));
  }, [tracks.value]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const selectable = list.filter((t) => !inPlaylist.has(t.id));
  const allPicked = selectable.length > 0 && selectable.every((t) => picked.has(t.id));

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleAll = () =>
    setPicked((cur) => {
      const next = new Set(cur);
      for (const t of selectable) allPicked ? next.delete(t.id) : next.add(t.id);
      return next;
    });

  const add = async () => {
    // Порядок добавления — как в списке, а не в порядке нажатий.
    const ids = all.filter((t) => picked.has(t.id)).map((t) => t.id);
    const n = await addToPlaylist(playlistId, ids);
    showToast(`Добавлено в «${pl?.name ?? "плейлист"}»: ${n} ${plural(n, ["трек", "трека", "треков"])}`);
    closeLayer();
  };

  return (
    <div class="layer full">
      <header class="top">
        <div class="top-side wide">
          <button class="text-btn" onClick={closeLayer}>
            Отмена
          </button>
        </div>
        <div class="top-title">
          <h1>Добавить треки</h1>
          <div class="top-sub">{pl?.name}</div>
        </div>
        <div class="top-side wide right">
          {selectable.length > 0 && (
            <button class="text-btn" onClick={toggleAll}>
              {allPicked ? "Снять" : "Все"}
            </button>
          )}
        </div>
      </header>
      <div class="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Поиск по трекам"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          enterkeyhint="search"
        />
      </div>
      <VirtualList
        count={list.length}
        rowHeight={TRACK_ROW_H}
        empty={
          <div class="empty">
            <h2>{tracks.value.length ? "Ничего не найдено" : "В библиотеке нет треков"}</h2>
          </div>
        }
        row={(i) => {
          const t = list[i];
          const already = inPlaylist.has(t.id);
          const on = already || picked.has(t.id);
          return (
            <div class={`row track ${picked.has(t.id) ? "selected" : ""} ${already ? "disabled" : ""}`}>
              <button class="row-main" disabled={already} onClick={() => toggle(t.id)}>
                <CheckBox checked={on} />
                <div class="thumb">
                  <Cover id={t.coverId} seed={t.album || t.artist || t.title} />
                </div>
                <div class="meta">
                  <div class="title">{t.title}</div>
                  <div class="sub">{already ? "Уже в плейлисте" : t.artist || "Неизвестный исполнитель"}</div>
                </div>
                <div class="dur">{t.duration ? fmtTime(t.duration) : ""}</div>
              </button>
            </div>
          );
        }}
      />
      <div class="pick-footer">
        <button class="btn primary wide" disabled={picked.size === 0} onClick={add}>
          {picked.size ? `Добавить: ${picked.size}` : "Выберите треки"}
        </button>
      </div>
    </div>
  );
}
