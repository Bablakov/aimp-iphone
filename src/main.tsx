import { render } from "preact";
import { registerSW } from "virtual:pwa-register";
import { loadEq } from "./core/eq";
import { initPlayer } from "./core/player";
import { initStore, ready } from "./core/store";
import "./styles.css";
import { App } from "./ui/App";
import { initDropImport } from "./ui/importer";
import { initNav } from "./ui/nav";

initNav();
initDropImport();
render(<App />, document.getElementById("app")!);

async function boot(): Promise<void> {
  try {
    await Promise.all([initStore(), loadEq()]);
    await initPlayer();
  } catch (e) {
    // Без IndexedDB (например, приватный режим старого Safari) приложение всё равно открывается — пустым.
    console.error("boot failed", e);
    ready.value = true;
  }
}

void boot();

// Новая версия ставится в фоне и подхватывается при следующем открытии.
registerSW({ immediate: true });
