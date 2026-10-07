import { useEffect, useState } from "preact/hooks";
import { hueFromString } from "../core/format";
import { coverUrl } from "../core/store";
import { Icon, type IconName } from "./Icon";

/** Квадратная обложка; размер задаёт родитель. Без картинки — цветная заглушка. */
export function Cover({ id, seed, icon = "music" }: { id: string | null | undefined; seed: string; icon?: IconName }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    setUrl(undefined);
    if (id) void coverUrl(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div class="cover" style={{ "--h": hueFromString(seed) } as Record<string, number>}>
      {url ? <img src={url} alt="" draggable={false} /> : <Icon name={icon} size={22} />}
    </div>
  );
}
