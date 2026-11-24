import { join } from 'node:path';
import { Constants } from '../constants.js';
import type { ScreenshotTheme } from '../enum.js';
import { SquintError } from '../errors.js';
import { requireUniqueScreenshots, type Manifest, type ManifestEntry } from '../manifest.js';
import type { StorageRepository } from '../repositories/storage.repository.js';
import { toSlug } from '../utils.js';

export type ReportAttachment = { name: string; contentType: string; path?: string; body?: Buffer };

type ScreenshotKey = Omit<ManifestEntry, 'file'>;

const { AttachmentPrefix, AttachmentSeparator, ContentType, FileExtension } = Constants.Playwright;

export const getAttachmentName = ({ name, theme, viewport }: ScreenshotKey) =>
  [AttachmentPrefix, theme, viewport, name].join(AttachmentSeparator);

export class ReportService {
  constructor(private storageRepository: StorageRepository) {}

  async write(outputDir: string, attachments: ReportAttachment[]): Promise<Manifest> {
    const screenshots = getScreenshots(attachments);
    requireUniqueScreenshots(screenshots);

    await this.storageRepository.removeDirectory(outputDir);
    await this.storageRepository.createDirectory(outputDir);

    const files = new Set<string>();
    const manifest: Manifest = { screenshots: [] };
    for (const { name, theme, viewport, attachment } of screenshots) {
      const file = getFileName(files, { name, theme, viewport });
      await this.writeScreenshot(join(outputDir, file), attachment);
      manifest.screenshots.push({ name, theme, viewport, file });
    }

    const path = join(outputDir, Constants.Manifest.FileName);
    await this.storageRepository.writeFile(path, Buffer.from(JSON.stringify(manifest, null, 2)));

    return manifest;
  }

  private writeScreenshot(target: string, { name, path, body }: ReportAttachment) {
    if (path) {
      return this.storageRepository.copyFile(path, target);
    }

    if (body) {
      return this.storageRepository.writeFile(target, body);
    }

    throw new SquintError(`Screenshot attachment is empty: ${name}`);
  }
}

const getScreenshots = (attachments: ReportAttachment[]) => {
  const screenshots: Array<ScreenshotKey & { attachment: ReportAttachment }> = [];
  for (const attachment of attachments) {
    const key = parseAttachment(attachment);
    if (key) {
      screenshots.push({ ...key, attachment });
    }
  }

  return screenshots.toSorted((a, b) => getSortKey(a).localeCompare(getSortKey(b)));
};

const parseAttachment = ({ name, contentType }: ReportAttachment): ScreenshotKey | undefined => {
  const [prefix, theme, viewport, ...rest] = name.split(AttachmentSeparator);
  if (prefix !== AttachmentPrefix || contentType !== ContentType) {
    return;
  }

  if (!Constants.Manifest.Themes.has(theme) || !viewport || rest.length === 0) {
    throw new SquintError(`Invalid screenshot attachment: ${name}`);
  }

  return { name: rest.join(AttachmentSeparator), theme: theme as ScreenshotTheme, viewport };
};

const getSortKey = ({ name, theme, viewport }: ScreenshotKey) => JSON.stringify([name, theme, viewport]);

const getFileName = (files: Set<string>, { name, theme, viewport }: ScreenshotKey) => {
  const base = toSlug(`${name}-${theme}-${viewport}`);
  let file = `${base}${FileExtension}`;
  for (let index = 2; files.has(file); index++) {
    file = `${base}-${index}${FileExtension}`;
  }

  files.add(file);

  return file;
};
