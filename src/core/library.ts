import { parseBlob, selectCover, type IPicture } from "music-metadata";
import * as DB from "./db";
import { hashBytes, mimeFromName, titleFromFileName, uid } from "./format";
import { appendTracks, tracks } from "./store";
import type { Track } from "./types";

export interface ImportReport {
  added: number;
  duplicates: number;
  /** Форматы, которые этот браузер не умеет играть (ogg, wma, ape…). */
  unsupported: string[];
  failed: string[];
  /** id всех треков из выбранных файлов, в порядке выбора (включая уже бывшие в библиотеке). */
  ids: string[];
}

export type ImportProgress = (done: number, total: number, name: string) => void;

const COVER_MAX_SIDE = 512;

let probe: HTMLAudioElement | null = null;
function canPlay(mime: string): boolean {
  probe ??= document.createElement("audio");
  return probe.canPlayType(mime) !== "";
}

/** Длительность через сам браузер — запасной путь, когда в тегах её нет (VBR mp3 без заголовка). */
function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    const done = (v: number) => {
      a.removeAttribute("src");
      a.load();
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(0), 8000);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(a.duration) ? a.duration : 0);
    };
    a.onerror = () => {
      clearTimeout(timer);
      done(0);
    };
    a.src = url;
  });
}

/** Уменьшает обложку до превью: оригиналы по несколько МБ в списке ни к чему. */
async function makeThumb(pic: IPicture): Promise<Blob> {
  const raw = new Blob([pic.data as BlobPart], { type: pic.format || "image/jpeg" });
  try {
    const bmp = await createImageBitmap(raw);
    const k = Math.min(1, COVER_MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (k === 1 && raw.size < 150_000) {
      bmp.close();
      return raw;
    }
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return out ?? raw;
  } catch {
    return raw;
  }
}

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function importFiles(files: File[], onProgress?: ImportProgress): Promise<ImportReport> {
  const report: ImportReport = { added: 0, duplicates: 0, unsupported: [], failed: [], ids: [] };
  const sigs = new Map(tracks.value.map((t) => [t.sig, t.id]));
  const knownCovers = new Set(tracks.value.map((t) => t.coverId).filter(Boolean) as string[]);
  let batch: Track[] = [];
  let lastFlush = performance.now();

  const flush = () => {
    appendTracks(batch);
    batch = [];
    lastFlush = performance.now();
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    const sig = `${file.name}|${file.size}`;
    const known = sigs.get(sig);
    if (known) {
      report.duplicates++;
      report.ids.push(known);
      continue;
    }
    const mime = mimeFromName(file.name, file.type);
    if (!canPlay(mime)) {
      report.unsupported.push(file.name);
      continue;
    }

    try {
      let meta: Awaited<ReturnType<typeof parseBlob>> | null = null;
      try {
        meta = await parseBlob(file, { skipPostHeaders: true });
      } catch {
        // Битые или нестандартные теги не повод отказывать файлу: играть он всё равно сможет.
      }
      const c = meta?.common;
      let duration = num(meta?.format.duration);
      if (duration <= 0) duration = await probeDuration(file);

      let cover: { id: string; blob: Blob } | null = null;
      let coverId: string | null = null;
      const pic = selectCover(c?.picture);
      if (pic) {
        coverId = hashBytes(pic.data);
        if (!knownCovers.has(coverId)) cover = { id: coverId, blob: await makeThumb(pic) };
      }

      const track: Track = {
        id: uid(),
        sig,
        title: c?.title?.trim() || titleFromFileName(file.name),
        artist: c?.artist?.trim() || "",
        album: c?.album?.trim() || "",
        albumArtist: c?.albumartist?.trim() || "",
        trackNo: num(c?.track?.no),
        year: num(c?.year),
        duration,
        size: file.size,
        mime,
        fileName: file.name,
        coverId,
        addedAt: Date.now() + i,
      };
      // Файл копируется во внутреннее хранилище приложения — оригинал можно не хранить.
      await DB.putTrack(track, file, cover);
      if (coverId) knownCovers.add(coverId);
      sigs.set(sig, track.id);
      report.ids.push(track.id);
      batch.push(track);
      report.added++;
      if (batch.length >= 25 || performance.now() - lastFlush > 400) flush();
    } catch (e) {
      console.warn("import failed", file.name, e);
      report.failed.push(file.name);
      // Переполненное хранилище лучше показать сразу, а не после сотни одинаковых ошибок.
      if (e instanceof DOMException && e.name === "QuotaExceededError") break;
    }
  }
  flush();
  onProgress?.(files.length, files.length, "");
  return report;
}

export async function storageInfo(): Promise<{ usage: number; quota: number; persisted: boolean } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const persisted = (await navigator.storage.persisted?.()) ?? false;
  return { usage, quota, persisted };
}

export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
