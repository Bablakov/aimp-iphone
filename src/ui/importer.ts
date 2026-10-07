import { signal } from "@preact/signals";
import { importFiles } from "../core/library";
import { isAudioName, plural } from "../core/format";
import { requestPersistence } from "../core/library";
import { showToast } from "../core/store";

export const importProgress = signal<{ done: number; total: number; name: string } | null>(null);

const ACCEPT = "audio/*,.mp3,.m4a,.aac,.wav,.flac,.aiff,.aif,.caf,.ogg,.opus";

/** Открывает системный выбор файлов. Вызывать прямо из обработчика нажатия — иначе iOS не откроет пикер. */
export function pickAndImport(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ACCEPT;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length) void runImport(files);
  };
  input.click();
}

export async function runImport(files: File[]): Promise<void> {
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
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => isAudioName(f.name) || f.type.startsWith("audio/"));
    if (files.length) void runImport(files);
  });
}
