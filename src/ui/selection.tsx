import { plural } from "../core/format";
import * as P from "../core/player";
import { removeManyFromPlaylist, removeTracks, showToast } from "../core/store";
import { pickPlaylist } from "./actions";
import { confirmDialog } from "./dialogs";
import { Icon, type IconName } from "./Icon";
import { clearSelection, selectAll, selectedInOrder, selection } from "./select";

/** Шапка режима выбора: «Отмена · Выбрано N · Все/Снять». */
export function SelectionHeader({ order }: { order: string[] }) {
  const n = selectedInOrder(order).length;
  const all = n > 0 && n === order.length;
  return (
    <header class="top">
      <div class="top-side wide">
        <button class="text-btn" onClick={clearSelection}>
          Отмена
        </button>
      </div>
      <div class="top-title">
        <h1>{n ? `Выбрано: ${n}` : "Выберите треки"}</h1>
      </div>
      <div class="top-side wide right">
        <button class="text-btn" onClick={() => (all ? selectAll([]) : selectAll(order))}>
          {all ? "Снять" : "Все"}
        </button>
      </div>
    </header>
  );
}

function Action({ icon, label, onClick, danger, disabled }: { icon: IconName; label: string; onClick: () => void; danger?: boolean; disabled: boolean }) {
  return (
    <button class={`sel-action ${danger ? "danger" : ""}`} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}

/**
 * Панель действий над выбранными треками. `order` — id в порядке показа (чтобы «следом»
 * и добавление в плейлист сохраняли порядок списка). `playlistId` — мы внутри плейлиста.
 */
export function SelectionBar({ order, playlistId }: { order: string[]; playlistId?: string }) {
  if (!selection.value) return null;
  const ids = selectedInOrder(order);
  const none = ids.length === 0;
  const word = (n: number) => `${n} ${plural(n, ["трек", "трека", "треков"])}`;

  const removeFromLibrary = async () => {
    if (!(await confirmDialog("Удалить треки?", `${word(ids.length)} будет удалено с телефона вместе с файлами.`, "Удалить", true))) return;
    await removeTracks(ids);
    P.onTracksRemoved(ids);
    clearSelection();
  };

  return (
    <div class="sel-bar">
      <Action icon="addlist" label="В плейлист" disabled={none} onClick={() => pickPlaylist(ids, clearSelection)} />
      <Action
        icon="playnext"
        label="Следом"
        disabled={none}
        onClick={() => {
          P.playNextMany(ids);
          showToast(`Сыграет следом: ${ids.length}`);
          clearSelection();
        }}
      />
      <Action
        icon="queue"
        label="В очередь"
        disabled={none}
        onClick={() => {
          P.enqueueMany(ids);
          showToast(`Добавлено в очередь: ${ids.length}`);
          clearSelection();
        }}
      />
      {playlistId ? (
        <Action
          icon="close"
          label="Убрать"
          disabled={none}
          onClick={async () => {
            await removeManyFromPlaylist(playlistId, new Set(ids));
            showToast(`Убрано из плейлиста: ${ids.length}`);
            clearSelection();
          }}
        />
      ) : (
        <Action icon="trash" label="Удалить" danger disabled={none} onClick={removeFromLibrary} />
      )}
    </div>
  );
}
