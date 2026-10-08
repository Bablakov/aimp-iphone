import { signal } from "@preact/signals";
import { importFiles, requestPersistence } from "../core/library";
import { isAudioName, plural } from "../core/format";
import { addToPlaylist, createPlaylist, playlists, showToast } from "../core/store";
import { askText, openSheet, type SheetItem } from "./dialogs";
import { openLayer } from "./nav";

export const importProgress = signal<{ done: number; total: number; name: string } | null>(null);

const ACCEPT = "audio/*,.mp3,.m4a,.aac,.wav,.flac,.aiff,.aif,.caf,.ogg,.opus";

type PickKind = "files" | "folder";

const isAudio = (f: File) => isAudioName(f.name) || f.type.startsWith("audio/");
const pathOf = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

/**
 * Открывает системный выбор файлов или папки. Вызывать прямо из обработчика нажатия — иначе iOS не
 * откроет пикер. Для папки берутся все аудиофайлы внутри, включая вложенные папки.
 */
function openPicker(kind: PickKind, onPicked: (files: File[], folderName: string) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  if (kind === "folder") input.setAttribute("webkitdirectory", "");
  else input.accept = ACCEPT;
  input.onchange = () => {
    let files = Array.from(input.files ?? []);
    let folderName = "";
    if (kind === "folder") {
      files = files.filter(isAudio).sort((a, b) => collator.compare(pathOf(a), pathOf(b)));
      if (!files.length) {
        showToast("В папке нет аудиофайлов");
        return;
      }
      folderName = pathOf(files[0]).split("/")[0] ?? "";
    }
    if (files.length) onPicked(files, folderName);
  };
  input.click();
}

const pickItems = (onPicked: (files: File[], folderName: string) => void): SheetItem[] => [
  { label: "Выбрать файлы…", icon: "plus", onSelect: () => openPicker("files", onPicked) },
  { label: "Папку целиком…", icon: "folder", onSelect: () => openPicker("folder", onPicked) },
];

/** Добавление в общую библиотеку: файлами или папкой целиком. */
export function pickAndImport(): void {
  openSheet({ title: "Добавить музыку", items: pickItems((files) => void runImport(files)) });
}

/** Добавление в существующий плейлист: новые файлы попадают и в библиотеку, и в плейлист. */
export function pickAndImportToPlaylist(playlistId: string): void {
  const name = playlists.value.find((p) => p.id === playlistId)?.name ?? "плейлист";
  openSheet({
    title: `Добавить в «${name}»`,
    items: [
      ...pickItems((files) => void runImport(files, playlistId)),
      { label: "Из библиотеки…", icon: "list", onSelect: () => openLayer({ type: "picker", playlistId }) },
    ],
  });
}

/** Новый плейлист: сначала источник треков, затем название — так выбор файлов остаётся в «жесте» нажатия. */
export function createPlaylistFlow(): void {
  const withName = async (folderName: string, then: (playlistId: string) => void | Promise<void>) => {
    const name = await askText("Новый плейлист", folderName, "Название");
    if (!name) return;
    const p = await createPlaylist(name);
    await then(p.id);
  };
  openSheet({
    title: "Новый плейлист",
    items: [
      ...pickItems((files, folder) => void withName(folder, (id) => runImport(files, id))),
      { label: "Из библиотеки…", icon: "list", onSelect: () => void withName("", (id) => openLayer({ type: "picker", playlistId: id })) },
      { label: "Пустой плейлист", icon: "plus", onSelect: () => void withName("", () => {}) },
    ],
  });
}

export async function runImport(files: File[], playlistId?: string): Promise<void> {
  if (importProgress.value) return;
  importProgress.value = { done: 0, total: files.length, name: "" };
  // Просим не вычищать хранилище — иначе Safari может удалить музыку при нехватке места.
  void requestPersistence();
  try {
    const r = await importFiles(files, (done, total, name) => {
      importProgress.value = { done, total, name };
    });
    const parts: string[] = [];
    if (r.added) parts.push(`Добавлено: ${r.added} ${plural(r.added, ["трек", "трека", "треков"])}`);
    if (r.duplicates) parts.push(`уже были: ${r.duplicates}`);
    if (playlistId && r.ids.length) {
      const n = await addToPlaylist(playlistId, r.ids);
      const name = playlists.value.find((p) => p.id === playlistId)?.name ?? "плейлист";
      parts.push(`в «${name}»: ${n}`);
    }
    if (r.unsupported.length) parts.push(`формат не поддерживается iOS: ${r.unsupported.length}`);
    if (r.failed.length) parts.push(`ошибок: ${r.failed.length}`);
    showToast(parts.join(" · ") || "Ничего не добавлено", 5500);
  } catch (e) {
    console.error(e);
    showToast("Импорт прерван: не хватает места или хранилище недоступно", 6000);
  } finally {
    importProgress.value = null;
  }
}

/** На десктопе файлы можно просто перетащить в окно. */
export function initDropImport(): void {
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []).filter(isAudio);
    if (files.length) void runImport(files);
  });
}
