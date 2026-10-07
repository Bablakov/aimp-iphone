import * as P from "../core/player";
import { addToPlaylist, createPlaylist, playlists, removeFromPlaylist, removeTracks, showToast, UNKNOWN_ARTIST } from "../core/store";
import type { Track } from "../core/types";
import { askText, confirmDialog, openSheet, type SheetItem } from "./dialogs";
import { openLayer } from "./nav";

const norm = (s: string) => s.trim().toLowerCase();

/** Выбор плейлиста для добавления треков (или создание нового). */
export function pickPlaylist(trackIds: string[], onDone?: () => void): void {
  openSheet({
    title: "Добавить в плейлист",
    items: [
      {
        label: "Новый плейлист…",
        icon: "plus",
        onSelect: async () => {
          const name = await askText("Новый плейлист", "", "Название");
          if (!name) return;
          await createPlaylist(name, trackIds);
          showToast(`Создан «${name}»: ${trackIds.length}`);
          onDone?.();
        },
      },
      ...playlists.value.map((p): SheetItem => ({
        label: p.name,
        icon: "list",
        onSelect: async () => {
          const n = await addToPlaylist(p.id, trackIds);
          showToast(n ? `Добавлено в «${p.name}»: ${n}` : `Уже есть в «${p.name}»`);
          onDone?.();
        },
      })),
    ],
  });
}

export async function deleteFromLibrary(t: Track): Promise<void> {
  if (!(await confirmDialog("Удалить трек?", `«${t.title}» будет удалён с телефона вместе с файлом.`, "Удалить", true))) return;
  await removeTracks([t.id]);
  P.onTracksRemoved([t.id]);
}

/** Меню трека. `playlist` — если список открыт внутри плейлиста. */
export function trackMenu(t: Track, playlist?: { id: string; index: number }): void {
  const items: SheetItem[] = [
    { label: "Играть следом", icon: "playnext", onSelect: () => (P.playNext(t.id), showToast("Сыграет следующим")) },
    { label: "В конец очереди", icon: "queue", onSelect: () => (P.enqueue(t.id), showToast("Добавлено в очередь")) },
    { label: "В плейлист…", icon: "addlist", onSelect: () => pickPlaylist([t.id]) },
  ];
  if (t.album) {
    const artist = t.albumArtist || t.artist || UNKNOWN_ARTIST;
    items.push({ label: "Перейти к альбому", icon: "album", onSelect: () => openLayer({ type: "album", key: `${norm(t.album)}|${norm(artist)}` }) });
  }
  items.push({ label: "Перейти к исполнителю", icon: "artist", onSelect: () => openLayer({ type: "artist", key: norm(t.artist || UNKNOWN_ARTIST) }) });
  if (playlist) {
    items.push({
      label: "Убрать из плейлиста",
      icon: "close",
      onSelect: () => void removeFromPlaylist(playlist.id, playlist.index),
    });
  }
  items.push({ label: "Удалить с телефона", icon: "trash", onSelect: () => void deleteFromLibrary(t), danger: true });
  openSheet({ title: t.title, subtitle: t.artist || undefined, items });
}
