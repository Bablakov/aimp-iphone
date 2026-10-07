import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { Icon, type IconName } from "./Icon";

export interface SheetItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  /** Подсветить как выбранный пункт (например, текущая скорость). */
  checked?: boolean;
  onSelect: () => void;
}

interface SheetSpec {
  title?: string;
  subtitle?: string;
  items: SheetItem[];
}

const sheet = signal<SheetSpec | null>(null);

export function openSheet(spec: SheetSpec): void {
  sheet.value = spec;
}
export function closeSheet(): void {
  sheet.value = null;
}

interface TextDialog {
  kind: "text";
  title: string;
  value: string;
  placeholder: string;
  resolve: (v: string | null) => void;
}
interface ConfirmDialog {
  kind: "confirm";
  title: string;
  message: string;
  okLabel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}
const dialog = signal<TextDialog | ConfirmDialog | null>(null);

export function askText(title: string, value = "", placeholder = ""): Promise<string | null> {
  return new Promise((resolve) => {
    dialog.value = { kind: "text", title, value, placeholder, resolve };
  });
}

export function confirmDialog(title: string, message: string, okLabel = "ОК", danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.value = { kind: "confirm", title, message, okLabel, danger, resolve };
  });
}

function TextBody({ d }: { d: TextDialog }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (v: string | null) => {
    dialog.value = null;
    d.resolve(v);
  };
  return (
    <form
      class="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        finish(ref.current?.value.trim() || null);
      }}
    >
      <h3>{d.title}</h3>
      <input ref={ref} class="field" type="text" value={d.value} placeholder={d.placeholder} maxLength={80} />
      <div class="dialog-actions">
        <button type="button" class="btn" onClick={() => finish(null)}>
          Отмена
        </button>
        <button type="submit" class="btn primary">
          Готово
        </button>
      </div>
    </form>
  );
}

export function Dialogs() {
  const s = sheet.value;
  const d = dialog.value;
  return (
    <>
      {s && (
        <div class="backdrop" onClick={closeSheet}>
          <div class="sheet" onClick={(e) => e.stopPropagation()} role="menu">
            {(s.title || s.subtitle) && (
              <div class="sheet-head">
                {s.title && <div class="sheet-title">{s.title}</div>}
                {s.subtitle && <div class="sheet-sub">{s.subtitle}</div>}
              </div>
            )}
            <div class="sheet-items">
              {s.items.map((it) => (
                <button
                  key={it.label}
                  class={`sheet-item ${it.danger ? "danger" : ""}`}
                  onClick={() => {
                    closeSheet();
                    it.onSelect();
                  }}
                >
                  {it.icon && <Icon name={it.icon} size={22} />}
                  <span>{it.label}</span>
                  {it.checked && <Icon name="check" size={20} class="check" />}
                </button>
              ))}
            </div>
            <button class="sheet-cancel" onClick={closeSheet}>
              Отмена
            </button>
          </div>
        </div>
      )}
      {d && (
        <div class="backdrop center">
          {d.kind === "text" ? (
            <TextBody d={d} />
          ) : (
            <div class="dialog">
              <h3>{d.title}</h3>
              <p>{d.message}</p>
              <div class="dialog-actions">
                <button
                  class="btn"
                  onClick={() => {
                    dialog.value = null;
                    d.resolve(false);
                  }}
                >
                  Отмена
                </button>
                <button
                  class={`btn ${d.danger ? "danger" : "primary"}`}
                  onClick={() => {
                    dialog.value = null;
                    d.resolve(true);
                  }}
                >
                  {d.okLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
