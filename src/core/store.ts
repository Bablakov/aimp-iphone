import { computed, signal } from "@preact/signals";
import * as DB from "./db";
import { uid } from "./format";
import type { Playlist, Track } from "./types";

export const tracks = signal<Track[]>([]);
export const playlists = signal<Playlist[]>([]);
export const ready = signal(false);

export const trackMap = computed(() => new Map(tracks.value.map((t) => [t.id, t])));

export interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  coverId: string | null;
  year: number;
  trackIds: string[];
  duration: number;
}

export interface ArtistGroup {
  key: string;
  artist: string;
  coverId: string | null;
  trackIds: string[];
  albums: number;
}

export const UNKNOWN_ARTIST = "Неизвестный исполнитель";
export const UNKNOWN_ALBUM = "Без альбома";

const norm = (s: string) => s.trim().toLowerCase();

/** Порядок внутри альбома: по номеру трека, затем по названию. */
export function byTrackNo(a: Track, b: Track): number {
  return a.trackNo - b.trackNo || a.title.localeCompare(b.title, "ru");
}

export const albums = computed<AlbumGroup[]>(() => {
  const map = new Map<string, { g: AlbumGroup; items: Track[] }>();
  for (const t of tracks.value) {
    if (!t.album) continue;
    const artist = t.albumArtist || t.artist || UNKNOWN_ARTIST;
    const key = `${norm(t.album)}|${norm(artist)}`;
    let e = map.get(key);
    if (!e) {
      e = { g: { key, album: t.album, artist, coverId: null, year: 0, trackIds: [], duration: 0 }, items: [] };
      map.set(key, e);
    }
    e.items.push(t);
  }
  const out: AlbumGroup[] = [];
  for (const { g, items } of map.values()) {
    items.sort(byTrackNo);
    g.trackIds = items.map((t) => t.id);
    g.coverId = items.find((t) => t.coverId)?.coverId ?? null;
    g.year = items.find((t) => t.year)?.year ?? 0;
    g.duration = items.reduce((s, t) => s + t.duration, 0);
    out.push(g);
  }
  return out.sort((a, b) => a.album.localeCompare(b.album, "ru"));
});

export const artists = computed<ArtistGroup[]>(() => {
  const map = new Map<string, ArtistGroup & { albumKeys: Set<string> }>();
  for (const t of tracks.value) {
    const name = t.artist || UNKNOWN_ARTIST;
    const key = norm(name);
    let g = map.get(key);
    if (!g) {
      g = { key, artist: name, coverId: null, trackIds: [], albums: 0, albumKeys: new Set() };
      map.set(key, g);
    }
    g.trackIds.push(t.id);
    g.coverId ??= t.coverId;
    if (t.album) g.albumKeys.add(norm(t.album));
  }
  return [...map.values()]
    .map(({ albumKeys, ...g }) => ({ ...g, albums: albumKeys.size }))
    .sort((a, b) => a.artist.localeCompare(b.artist, "ru"));
});

// ───────── тосты ─────────

export const toast = signal<string | null>(null);
let toastTimer = 0;
export function showToast(msg: string, ms = 3200): void {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = null), ms);
}

// ───────── загрузка и изменение библиотеки ─────────

export async function initStore(): Promise<void> {
  const [t, p] = await Promise.all([DB.allTracks(), DB.allPlaylists()]);
  tracks.value = t;
  playlists.value = p.sort((a, b) => a.createdAt - b.createdAt);
  ready.value = true;
}

export function appendTracks(added: Track[]): void {
  if (added.length) tracks.value = [...tracks.value, ...added];
}

export async function removeTracks(ids: string[]): Promise<void> {
  const gone = new Set(ids);
  const remaining = tracks.value.filter((t) => !gone.has(t.id));
  const stillUsed = new Set(remaining.map((t) => t.coverId).filter(Boolean));
  const orphans = [...new Set(tracks.value.filter((t) => gone.has(t.id) && t.coverId && !stillUsed.has(t.coverId)).map((t) => t.coverId!))];
  await DB.deleteTracks(ids, orphans);
  tracks.value = remaining;
  // Плейлисты не должны хранить ссылки на несуществующие треки.
  const touched = playlists.value.filter((p) => p.trackIds.some((id) => gone.has(id)));
  for (const p of touched) await savePlaylist({ ...p, trackIds: p.trackIds.filter((id) => !gone.has(id)) });
}

export async function wipeLibrary(): Promise<void> {
  await DB.clearLibrary();
  tracks.value = [];
  playlists.value = [];
}

// ───────── плейлисты ─────────

async function savePlaylist(p: Playlist): Promise<void> {
  await DB.putPlaylist(p);
  const exists = playlists.value.some((x) => x.id === p.id);
  playlists.value = exists ? playlists.value.map((x) => (x.id === p.id ? p : x)) : [...playlists.value, p];
}

export async function createPlaylist(name: string, trackIds: string[] = []): Promise<Playlist> {
  const p: Playlist = { id: uid(), name: name.trim() || "Плейлист", trackIds, createdAt: Date.now() };
  await savePlaylist(p);
  return p;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const p = playlists.value.find((x) => x.id === id);
  if (p && name.trim()) await savePlaylist({ ...p, name: name.trim() });
}

export async function removePlaylist(id: string): Promise<void> {
  await DB.deletePlaylist(id);
  playlists.value = playlists.value.filter((p) => p.id !== id);
}

export async function addToPlaylist(id: string, trackIds: string[]): Promise<number> {
  const p = playlists.value.find((x) => x.id === id);
  if (!p) return 0;
  const have = new Set(p.trackIds);
  const fresh = trackIds.filter((t) => !have.has(t));
  if (fresh.length) await savePlaylist({ ...p, trackIds: [...p.trackIds, ...fresh] });
  return fresh.length;
}

export async function removeFromPlaylist(id: string, index: number): Promise<void> {
  const p = playlists.value.find((x) => x.id === id);
  if (p) await savePlaylist({ ...p, trackIds: p.trackIds.filter((_, i) => i !== index) });
}

export async function removeManyFromPlaylist(id: string, trackIds: ReadonlySet<string>): Promise<void> {
  const p = playlists.value.find((x) => x.id === id);
  if (p) await savePlaylist({ ...p, trackIds: p.trackIds.filter((t) => !trackIds.has(t)) });
}

export async function movePlaylistTrack(id: string, from: number, to: number): Promise<void> {
  const p = playlists.value.find((x) => x.id === id);
  if (!p || to < 0 || to >= p.trackIds.length) return;
  const ids = p.trackIds.slice();
  const [m] = ids.splice(from, 1);
  ids.splice(to, 0, m);
  await savePlaylist({ ...p, trackIds: ids });
}

// ───────── обложки ─────────

const COVER_CACHE_LIMIT = 250;
const coverUrls = new Map<string, string>();
const coverPending = new Map<string, Promise<string | undefined>>();

/** Адрес обложки (blob:). Кэш ограничен, старые адреса освобождаются. */
export function coverUrl(id: string): Promise<string | undefined> {
  const hit = coverUrls.get(id);
  if (hit) {
    coverUrls.delete(id);
    coverUrls.set(id, hit); // освежаем для LRU
    return Promise.resolve(hit);
  }
  let p = coverPending.get(id);
  if (!p) {
    p = DB.getCover(id)
      .then((blob) => {
        if (!blob) return undefined;
        const url = URL.createObjectURL(blob);
        coverUrls.set(id, url);
        if (coverUrls.size > COVER_CACHE_LIMIT) {
          const oldest = coverUrls.keys().next().value!;
          URL.revokeObjectURL(coverUrls.get(oldest)!);
          coverUrls.delete(oldest);
        }
        return url;
      })
      .catch(() => undefined)
      .finally(() => coverPending.delete(id));
    coverPending.set(id, p);
  }
  return p;
}
