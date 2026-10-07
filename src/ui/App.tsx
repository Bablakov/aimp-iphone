import { toast, ready } from "../core/store";
import { Dialogs } from "./dialogs";
import { Icon, type IconName } from "./Icon";
import { importProgress } from "./importer";
import { layers, selectTab, tab, type TabName } from "./nav";
import { PickerLayer } from "./Picker";
import { EqLayer, MiniPlayer, NowPlaying, QueueLayer } from "./Player";
import { AlbumsScreen, ArtistsScreen, PlaylistsScreen, renderDetail, SettingsScreen, TracksScreen } from "./screens";

const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: "tracks", label: "Треки", icon: "music" },
  { name: "albums", label: "Альбомы", icon: "album" },
  { name: "artists", label: "Артисты", icon: "artist" },
  { name: "playlists", label: "Плейлисты", icon: "list" },
  { name: "settings", label: "Ещё", icon: "settings" },
];

function CurrentTab() {
  switch (tab.value) {
    case "tracks":
      return <TracksScreen />;
    case "albums":
      return <AlbumsScreen />;
    case "artists":
      return <ArtistsScreen />;
    case "playlists":
      return <PlaylistsScreen />;
    case "settings":
      return <SettingsScreen />;
  }
}

function ImportBanner() {
  const p = importProgress.value;
  if (!p) return null;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <div class="import-banner" role="status">
      <div>
        Импорт {p.done} из {p.total}
        {p.name && <span class="import-name"> · {p.name}</span>}
      </div>
      <div class="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function App() {
  if (!ready.value) return <div class="splash" />;
  const stack = layers.value;
  return (
    <div class="app">
      <main class="content">
        <CurrentTab />
        {stack.map((l, i) => {
          if (l.type === "album" || l.type === "artist" || l.type === "playlist") {
            return (
              <div class="layer detail" key={`${i}-${l.type}`}>
                {renderDetail(l)}
              </div>
            );
          }
          return null;
        })}
      </main>
      <MiniPlayer />
      <nav class="tabbar" role="tablist">
        {TABS.map((t) => (
          <button key={t.name} role="tab" aria-selected={tab.value === t.name} class={tab.value === t.name ? "on" : ""} onClick={() => selectTab(t.name)}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {stack.map((l, i) => {
        if (l.type === "player") return <NowPlaying key={`${i}-p`} />;
        if (l.type === "queue") return <QueueLayer key={`${i}-q`} />;
        if (l.type === "eq") return <EqLayer key={`${i}-e`} />;
        if (l.type === "picker") return <PickerLayer key={`${i}-k`} playlistId={l.playlistId} />;
        return null;
      })}
      <ImportBanner />
      {toast.value && <div class="toast" role="status">{toast.value}</div>}
      <Dialogs />
    </div>
  );
}
