export interface Track {
  id: string;
  /** «имя файла|размер» — по нему отсекаются повторные импорты одного файла. */
  sig: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNo: number;
  year: number;
  /** Секунды; 0, если определить не удалось. */
  duration: number;
  size: number;
  mime: string;
  fileName: string;
  coverId: string | null;
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export type RepeatMode = "off" | "all" | "one";

export interface EqState {
  enabled: boolean;
  preamp: number;
  gains: number[];
  preset: string;
}
