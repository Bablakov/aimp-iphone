import { useEffect, useMemo, useState } from "preact/hooks";
import { fmtBytes, fmtTotal, plural } from "../core/format";
import { storageInfo, requestPersistence } from "../core/library";
import * as P from "../core/player";
import {
  albums,
  artists,
  byTrackNo,
  movePlaylistTrack,
  playlists,
  removePlaylist,
  renamePlaylist,
  showToast,
  trackMap,
  tracks,
  UNKNOWN_ARTIST,
  wipeLibrary,
} from "../core/store";
import type { Track } from "../core/types";
import { eq } from "../core/eq";
import { trackMenu } from "./actions";
import { Cover } from "./Cover";
import { askText, confirmDialog, openSheet } from "./dialogs";
import { Icon, type IconName } from "./Icon";
import { createPlaylistFlow, pickAndImport, pickAndImportToPlaylist } from "./importer";
import { closeLayer, openLayer, type Layer } from "./nav";
import { selection, startSelect } from "./select";
import { SelectionBar, SelectionHeader } from "./selection";
import { TRACK_ROW_H, TrackRow } from "./TrackRow";
import { VirtualList } from "./VirtualList";

const ROW_H = 68;
const tracksWord = (n: number) => `${n} ${plural(n, ["трек", "трека", "треков"])}`;

// ───────── общие куски ─────────

function Header({ title, subtitle, left, right }: { title: string; subtitle?: string; left?: preact.ComponentChildren; right?: preact.ComponentChildren }) {
  return (
    <header class="top">
      <div class="top-side">{left}</div>
      <div class="top-title">
        <h1>{title}</h1>
        {subtitle && <div class="top-sub">{subtitle}</div>}
      </div>
      <div class="top-side right">{right}</div>
    </header>
  );
}

function BackButton() {
  return (
    <button class="icon-btn" onClick={closeLayer} aria-label="Назад">
      <Icon name="back" />
    </button>
  );
}

function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: preact.ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} size={56} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

function ImportButton({ primary }: { primary?: boolean }) {
  return (
    <button class={`btn ${primary ? "primary" : ""}`} onClick={pickAndImport}>
      <Icon name="plus" size={20} /> Добавить музыку
    </button>
  );
}

function PlayButtons({ ids }: { ids: string[] }) {
  return (
    <div class="play-buttons">
      <button class="btn primary" onClick={() => P.playQueue(ids, null, false)}>
        <Icon name="play" size={20} /> Играть
      </button>
      <button class="btn" onClick={() => P.playQueue(ids, null, true)}>
        <Icon name="shuffle" size={20} /> Перемешать
      </button>
    </div>
  );
}

/** На iPhone вкладка Safari чистится через 7 дней без захода; иконка на «Домой» — нет. */
function installHint(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia("(display-mode: standalone)").matches;
  if (!ios || standalone) return false;
  try {
    return localStorage.getItem("hint-install") !== "1";
  } catch {
    return true;
  }
}

function InstallHint() {
  const [show, setShow] = useState(installHint);
  if (!show) return null;
  return (
    <div class="hint">
      <div>
        Добавьте приложение на экран «Домой»: <b>Поделиться → На экран «Домой»</b>. Иначе Safari может удалить музыку, если долго не открывать сайт.
      </div>
      <button
        class="icon-btn"
        aria-label="Скрыть"
        onClick={() => {
          try {
            localStorage.setItem("hint-install", "1");
          } catch {
            /* без localStorage подсказка просто появится снова */
          }
          setShow(false);
        }}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

// ───────── Треки ─────────

type SortKey = "added" | "title" | "artist" | "album";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "added", label: "Сначала новые" },
  { key: "title", label: "По названию" },
  { key: "artist", label: "По исполнителю" },
  { key: "album", label: "По альбому" },
];

function loadSort(): SortKey {
  try {
    const v = localStorage.getItem("sort") as SortKey | null;
    if (v && SORTS.some((s) => s.key === v)) return v;
  } catch {
    /* значение по умолчанию */
  }
  return "added";
}

function sortTracks(list: Track[], key: SortKey): Track[] {
  const c = (a: string, b: string) => a.localeCompare(b, "ru");
  const out = list.slice();
  switch (key) {
    case "added":
      return out.sort((a, b) => b.addedAt - a.addedAt);
    case "title":
      return out.sort((a, b) => c(a.title, b.title));
    case "artist":
      return out.sort((a, b) => c(a.artist, b.artist) || c(a.album, b.album) || byTrackNo(a, b));
    case "album":
      return out.sort((a, b) => c(a.album, b.album) || byTrackNo(a, b));
  }
}

export function TracksScreen() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(loadSort);
  const all = tracks.value;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)) : all;
    return sortTracks(filtered, sort);
  }, [all, query, sort]);
  const ids = useMemo(() => list.map((t) => t.id), [list]);

  const pickSort = () =>
    openSheet({
      title: "Сортировка",
      items: SORTS.map((s) => ({
        label: s.label,
        checked: s.key === sort,
        onSelect: () => {
          setSort(s.key);
          try {
            localStorage.setItem("sort", s.key);
          } catch {
            /* не критично */
          }
        },
      })),
    });

  const selecting = selection.value !== null;
  return (
    <section class="screen">
      {selecting ? (
        <SelectionHeader order={ids} />
      ) : (
      <Header
        title="Треки"
        subtitle={all.length ? `${tracksWord(all.length)} · ${fmtTotal(all.reduce((s, t) => s + t.duration, 0))}` : undefined}
        left={
          <button class="icon-btn" onClick={pickSort} aria-label="Сортировка">
            <Icon name="sort" />
          </button>
        }
        right={
          <>
            {all.length > 0 && (
              <button class="icon-btn" onClick={() => startSelect()} aria-label="Выбрать несколько">
                <Icon name="select" />
              </button>
            )}
            <button class="icon-btn accent" onClick={pickAndImport} aria-label="Добавить музыку">
              <Icon name="plus" />
            </button>
          </>
        }
      />
      )}
      {all.length > 0 && (
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
      )}
      <VirtualList
        count={list.length}
        rowHeight={TRACK_ROW_H}
        header={
          <>
            <InstallHint />
            {list.length > 0 && !query && <PlayButtons ids={ids} />}
          </>
        }
        empty={
          all.length === 0 ? (
            <Empty
              icon="music"
              title="Пока пусто"
              text="Выберите аудиофайлы из «Файлов» или iCloud Drive — они скопируются в приложение и будут играть без интернета."
              action={<ImportButton primary />}
            />
          ) : (
            <Empty icon="search" title="Ничего не найдено" />
          )
        }
        row={(i) => {
          const t = list[i];
          return <TrackRow track={t} onPlay={() => P.playQueue(ids, t.id)} onMenu={() => trackMenu(t)} />;
        }}
      />
      {selecting && <SelectionBar order={ids} />}
    </section>
  );
}

// ───────── Альбомы и исполнители ─────────

export function AlbumsScreen() {
  const list = albums.value;
  return (
    <section class="screen">
      <Header title="Альбомы" subtitle={list.length ? `${list.length}` : undefined} />
      <VirtualList
        count={list.length}
        rowHeight={ROW_H}
        empty={<Empty icon="album" title="Альбомов нет" text="Альбомы собираются из тегов в файлах." />}
        row={(i) => {
          const a = list[i];
          return (
            <button class="row-main" onClick={() => openLayer({ type: "album", key: a.key })}>
              <div class="thumb big">
                <Cover id={a.coverId} seed={a.album} icon="album" />
              </div>
              <div class="meta">
                <div class="title">{a.album}</div>
                <div class="sub">
                  {a.artist} · {tracksWord(a.trackIds.length)}
                </div>
              </div>
              <Icon name="back" class="chev" size={18} />
            </button>
          );
        }}
      />
    </section>
  );
}

export function ArtistsScreen() {
  const list = artists.value;
  return (
    <section class="screen">
      <Header title="Исполнители" subtitle={list.length ? `${list.length}` : undefined} />
      <VirtualList
        count={list.length}
        rowHeight={ROW_H}
        empty={<Empty icon="artist" title="Исполнителей нет" />}
        row={(i) => {
          const a = list[i];
          return (
            <button class="row-main" onClick={() => openLayer({ type: "artist", key: a.key })}>
              <div class="thumb big round">
                <Cover id={a.coverId} seed={a.artist} icon="artist" />
              </div>
              <div class="meta">
                <div class="title">{a.artist}</div>
                <div class="sub">
                  {tracksWord(a.trackIds.length)}
                  {a.albums > 0 && ` · ${a.albums} ${plural(a.albums, ["альбом", "альбома", "альбомов"])}`}
                </div>
              </div>
              <Icon name="back" class="chev" size={18} />
            </button>
          );
        }}
      />
    </section>
  );
}

// ───────── Плейлисты ─────────

export function PlaylistsScreen() {
  const list = playlists.value;
  const create = createPlaylistFlow;
  return (
    <section class="screen">
      <Header
        title="Плейлисты"
        right={
          <button class="icon-btn accent" onClick={create} aria-label="Новый плейлист">
            <Icon name="plus" />
          </button>
        }
      />
      <VirtualList
        count={list.length}
        rowHeight={ROW_H}
        empty={
          <Empty
            icon="list"
            title="Плейлистов нет"
            text="Создайте плейлист и добавляйте в него треки через меню «⋯»."
            action={
              <button class="btn primary" onClick={create}>
                <Icon name="plus" size={20} /> Новый плейлист
              </button>
            }
          />
        }
        row={(i) => {
          const p = list[i];
          const first = p.trackIds.map((id) => trackMap.value.get(id)?.coverId).find(Boolean);
          return (
            <button class="row-main" onClick={() => openLayer({ type: "playlist", key: p.id })}>
              <div class="thumb big">
                <Cover id={first} seed={p.name} icon="list" />
              </div>
              <div class="meta">
                <div class="title">{p.name}</div>
                <div class="sub">{tracksWord(p.trackIds.length)}</div>
              </div>
              <Icon name="back" class="chev" size={18} />
            </button>
          );
        }}
      />
    </section>
  );
}

// ───────── Детальные экраны (слои) ─────────

function TrackListLayer(props: {
  title: string;
  subtitle: string;
  hero?: preact.ComponentChildren;
  right?: preact.ComponentChildren;
  list: Track[];
  numbered?: boolean;
  playlistId?: string;
  emptyText?: string;
  emptyAction?: preact.ComponentChildren;
}) {
  const { list } = props;
  const ids = list.map((t) => t.id);
  const selecting = selection.value !== null;
  return (
    <section class="screen layer-screen">
      {selecting ? (
        <SelectionHeader order={ids} />
      ) : (
        <Header
          title={props.title}
          subtitle={props.subtitle}
          left={<BackButton />}
          right={
            <>
              {list.length > 0 && (
                <button class="icon-btn" onClick={() => startSelect()} aria-label="Выбрать несколько">
                  <Icon name="select" />
                </button>
              )}
              {props.right}
            </>
          }
        />
      )}
      <VirtualList
        count={list.length}
        rowHeight={TRACK_ROW_H}
        header={
          <>
            {props.hero}
            {list.length > 0 && <PlayButtons ids={ids} />}
          </>
        }
        empty={<Empty icon="music" title="Здесь пусто" text={props.emptyText} action={props.emptyAction} />}
        row={(i) => {
          const t = list[i];
          return (
            <TrackRow
              track={t}
              number={props.numbered ? t.trackNo || i + 1 : undefined}
              subtitle={props.numbered ? undefined : t.artist || undefined}
              onPlay={() => P.playQueue(ids, t.id)}
              onMenu={() => (props.playlistId ? playlistTrackMenu(props.playlistId, i, list) : trackMenu(t))}
            />
          );
        }}
      />
      {selecting && <SelectionBar order={ids} playlistId={props.playlistId} />}
    </section>
  );
}

function playlistTrackMenu(playlistId: string, index: number, list: Track[]) {
  const t = list[index];
  // Переставить трек можно только внутри плейлиста, поэтому добавляем пункты к обычному меню.
  openSheet({
    title: t.title,
    subtitle: t.artist || undefined,
    items: [
      ...(index > 0 ? [{ label: "Выше", icon: "up" as const, onSelect: () => void movePlaylistTrack(playlistId, index, index - 1) }] : []),
      ...(index < list.length - 1 ? [{ label: "Ниже", icon: "down" as const, onSelect: () => void movePlaylistTrack(playlistId, index, index + 1) }] : []),
      { label: "Ещё…", icon: "more" as const, onSelect: () => trackMenu(t, { id: playlistId, index }) },
    ],
  });
}

export function AlbumLayer({ keyId }: { keyId: string }) {
  const album = albums.value.find((a) => a.key === keyId);
  const list = (album?.trackIds ?? []).map((id) => trackMap.value.get(id)).filter(Boolean) as Track[];
  if (!album) return <TrackListLayer title="Альбом" subtitle="" list={[]} />;
  return (
    <TrackListLayer
      title={album.album}
      subtitle={`${album.artist}${album.year ? ` · ${album.year}` : ""}`}
      list={list}
      numbered
      hero={
        <div class="hero">
          <div class="hero-cover">
            <Cover id={album.coverId} seed={album.album} icon="album" />
          </div>
          <div class="hero-meta">
            {tracksWord(list.length)} · {fmtTotal(album.duration)}
          </div>
        </div>
      }
    />
  );
}

export function ArtistLayer({ keyId }: { keyId: string }) {
  const artist = artists.value.find((a) => a.key === keyId);
  const list = ((artist?.trackIds ?? []).map((id) => trackMap.value.get(id)).filter(Boolean) as Track[]).sort(
    (a, b) => a.album.localeCompare(b.album, "ru") || byTrackNo(a, b),
  );
  return <TrackListLayer title={artist?.artist ?? UNKNOWN_ARTIST} subtitle={tracksWord(list.length)} list={list} />;
}

export function PlaylistLayer({ keyId }: { keyId: string }) {
  const pl = playlists.value.find((p) => p.id === keyId);
  const list = (pl?.trackIds ?? []).map((id) => trackMap.value.get(id)).filter(Boolean) as Track[];
  const menu = () =>
    pl &&
    openSheet({
      title: pl.name,
      items: [
        {
          label: "Переименовать",
          icon: "edit",
          onSelect: async () => {
            const name = await askText("Название плейлиста", pl.name);
            if (name) await renamePlaylist(pl.id, name);
          },
        },
        {
          label: "Удалить плейлист",
          icon: "trash",
          danger: true,
          onSelect: async () => {
            if (await confirmDialog("Удалить плейлист?", `«${pl.name}» будет удалён. Сами треки останутся в библиотеке.`, "Удалить", true)) {
              closeLayer();
              await removePlaylist(pl.id);
            }
          },
        },
      ],
    });
  const addButton = pl && (
    <button class="btn primary" onClick={() => pickAndImportToPlaylist(pl.id)}>
      <Icon name="plus" size={20} /> Добавить треки
    </button>
  );
  return (
    <TrackListLayer
      title={pl?.name ?? "Плейлист"}
      subtitle={`${tracksWord(list.length)} · ${fmtTotal(list.reduce((s, t) => s + t.duration, 0))}`}
      list={list}
      playlistId={pl?.id}
      emptyText="Добавьте файлы или папку целиком либо выберите треки из библиотеки."
      emptyAction={addButton}
      right={
        <>
          <button class="icon-btn accent" onClick={() => pl && pickAndImportToPlaylist(pl.id)} aria-label="Добавить треки в плейлист">
            <Icon name="plus" />
          </button>
          <button class="icon-btn" onClick={menu} aria-label="Меню плейлиста">
            <Icon name="more" />
          </button>
        </>
      }
    />
  );
}

export function renderDetail(layer: Layer) {
  switch (layer.type) {
    case "album":
      return <AlbumLayer keyId={layer.key} />;
    case "artist":
      return <ArtistLayer keyId={layer.key} />;
    case "playlist":
      return <PlaylistLayer keyId={layer.key} />;
    default:
      return null;
  }
}

// ───────── Настройки ─────────

export function SettingsScreen() {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof storageInfo>>>(null);
  const refresh = () => void storageInfo().then(setInfo);
  useEffect(refresh, [tracks.value.length]);
  const size = tracks.value.reduce((s, t) => s + t.size, 0);

  return (
    <section class="screen">
      <Header title="Настройки" />
      <div class="scroll pad">
        <h2 class="group">Библиотека</h2>
        <div class="card">
          <div class="kv">
            <span>Треков</span>
            <b>{tracks.value.length}</b>
          </div>
          <div class="kv">
            <span>Размер файлов</span>
            <b>{fmtBytes(size)}</b>
          </div>
          {info && (
            <div class="kv">
              <span>Занято в хранилище</span>
              <b>
                {fmtBytes(info.usage)} из {fmtBytes(info.quota)}
              </b>
            </div>
          )}
          <div class="kv">
            <span>Защита от очистки</span>
            <b>{info?.persisted ? "включена" : "не включена"}</b>
          </div>
          <div class="card-actions">
            <ImportButton primary />
            {!info?.persisted && (
              <button
                class="btn"
                onClick={async () => {
                  const ok = await requestPersistence();
                  showToast(ok ? "Хранилище защищено от автоочистки" : "Браузер не дал защиту — добавьте приложение на экран «Домой»");
                  refresh();
                }}
              >
                Защитить от очистки
              </button>
            )}
          </div>
        </div>

        <h2 class="group">Звук</h2>
        <div class="card">
          <button class="kv link" onClick={() => openLayer({ type: "eq" })}>
            <span>
              <Icon name="eq" size={20} /> Эквалайзер
            </span>
            <b>{eq.value.enabled ? eq.value.preset : "выключен"}</b>
          </button>
        </div>

        <h2 class="group">Опасная зона</h2>
        <div class="card">
          <button
            class="btn danger wide"
            disabled={tracks.value.length === 0 && playlists.value.length === 0}
            onClick={async () => {
              if (!(await confirmDialog("Стереть библиотеку?", "Все треки и плейлисты будут удалены с телефона. Это нельзя отменить.", "Стереть", true))) return;
              P.clearQueue();
              await wipeLibrary();
              refresh();
            }}
          >
            <Icon name="trash" size={20} /> Стереть всю библиотеку
          </button>
        </div>

        <p class="about">
          AIMP Web — неофициальный плеер в духе AIMP для iPhone. С проектом AIMP (aimp.ru) не связан. Музыка хранится только на вашем телефоне и никуда не отправляется.
          <br />
          Версия {__APP_VERSION__}
        </p>
      </div>
    </section>
  );
}

