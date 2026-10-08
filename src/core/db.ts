import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Playlist, Track } from "./types";

/**
 * Всё лежит в IndexedDB на самом телефоне. Аудиофайлы — отдельным хранилищем `blobs`,
 * чтобы список треков читался быстро и не тащил за собой гигабайты.
 */
interface Schema extends DBSchema {
  tracks: { key: string; value: Track };
  blobs: { key: string; value: Blob };
  covers: { key: string; value: Blob };
  playlists: { key: string; value: Playlist };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  // Версия схемы только растёт, upgrade ничего не удаляет и не пересоздаёт: библиотека и плейлисты
  // из прошлых версий приложения остаются на месте. Новые хранилища добавлять под `oldVersion < N`.
  dbPromise ??= openDB<Schema>("aimp-web", 1, {
    upgrade(d) {
      const stores = ["tracks", "blobs", "covers", "playlists", "kv"] as const;
      for (const name of stores) {
        if (d.objectStoreNames.contains(name)) continue;
        if (name === "tracks" || name === "playlists") d.createObjectStore(name, { keyPath: "id" });
        else d.createObjectStore(name);
      }
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("kv", key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put("kv", value, key);
}

export async function putTrack(track: Track, blob: Blob, cover: { id: string; blob: Blob } | null): Promise<void> {
  const d = await db();
  const tx = d.transaction(["tracks", "blobs", "covers"], "readwrite");
  await Promise.all([
    tx.objectStore("blobs").put(blob, track.id),
    tx.objectStore("tracks").put(track),
    cover ? tx.objectStore("covers").put(cover.blob, cover.id) : Promise.resolve(),
    tx.done,
  ]);
}

export async function deleteTracks(ids: string[], orphanCovers: string[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(["tracks", "blobs", "covers"], "readwrite");
  await Promise.all([
    ...ids.map((id) => tx.objectStore("tracks").delete(id)),
    ...ids.map((id) => tx.objectStore("blobs").delete(id)),
    ...orphanCovers.map((id) => tx.objectStore("covers").delete(id)),
    tx.done,
  ]);
}

export async function clearLibrary(): Promise<void> {
  const d = await db();
  const tx = d.transaction(["tracks", "blobs", "covers", "playlists"], "readwrite");
  await Promise.all([
    tx.objectStore("tracks").clear(),
    tx.objectStore("blobs").clear(),
    tx.objectStore("covers").clear(),
    tx.objectStore("playlists").clear(),
    tx.done,
  ]);
}

export async function putTrackMeta(track: Track): Promise<void> {
  await (await db()).put("tracks", track);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return (await db()).get("blobs", id);
}

export async function getCover(id: string): Promise<Blob | undefined> {
  return (await db()).get("covers", id);
}

export async function allTracks(): Promise<Track[]> {
  return (await db()).getAll("tracks");
}

export async function allPlaylists(): Promise<Playlist[]> {
  return (await db()).getAll("playlists");
}

export async function putPlaylist(p: Playlist): Promise<void> {
  await (await db()).put("playlists", p);
}

export async function deletePlaylist(id: string): Promise<void> {
  await (await db()).delete("playlists", id);
}
