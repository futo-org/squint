import { SquintError } from './errors.js';
import type { ScreenshotTheme } from './enum.js';

export type ManifestEntry = { name: string; theme: ScreenshotTheme; viewport: string; file: string };
export type Manifest = { screenshots: ManifestEntry[] };

export const requireUniqueScreenshots = (entries: Array<Omit<ManifestEntry, 'file'>>) => {
  const keys = new Set<string>();
  for (const { name, theme, viewport } of entries) {
    const key = `${name} (${theme}, ${viewport})`;
    if (keys.has(key)) {
      throw new SquintError(`Duplicate screenshot: ${key}`);
    }

    keys.add(key);
  }
};
