import type { TestCase, TestResult } from '@playwright/test/reporter';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SquintReporter, { screenshot } from './playwright.js';

type Attachment = TestResult['attachments'][number];

const newTest = (id: string) => ({ id }) as TestCase;
const newResult = (attachments: Attachment[]) => ({ attachments }) as TestResult;
const newAttachment = (name: string, body: string): Attachment => ({
  name,
  contentType: 'image/png',
  body: Buffer.from(body),
});

describe(SquintReporter.name, () => {
  let directory: string;
  let outputDir: string;

  const readManifest = () => JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf8'));
  const readScreenshot = (file: string) => readFileSync(join(outputDir, file), 'utf8');

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'squint-reporter-'));
    outputDir = join(directory, 'squint-report');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true });
  });

  describe('onEnd', () => {
    it('writes each squint attachment and lists it in the manifest', async () => {
      const path = join(directory, 'settings.png');
      writeFileSync(path, 'settings-png');
      const sut = new SquintReporter({ outputDir });
      sut.onTestEnd(newTest('a'), newResult([newAttachment('squint:light:desktop:home', 'home-png')]));
      sut.onTestEnd(
        newTest('b'),
        newResult([{ name: 'squint:dark:mobile:user/settings', contentType: 'image/png', path }]),
      );

      await sut.onEnd();

      const { screenshots } = readManifest();
      expect(screenshots).toEqual([
        { name: 'home', theme: 'light', viewport: 'desktop', file: expect.any(String) },
        { name: 'user/settings', theme: 'dark', viewport: 'mobile', file: expect.any(String) },
      ]);
      expect(screenshots.map(({ file }: { file: string }) => readScreenshot(file))).toEqual([
        'home-png',
        'settings-png',
      ]);
      expect(screenshots[1].file).toMatch(/^[a-z0-9-]+\.png$/);
    });

    it('ignores attachments that are not squint screenshots', async () => {
      const sut = new SquintReporter({ outputDir });
      sut.onTestEnd(
        newTest('a'),
        newResult([
          newAttachment('screenshot', 'failure-png'),
          { name: 'trace', contentType: 'application/zip', body: Buffer.from('zip') },
          newAttachment('squint:light:desktop:home', 'home-png'),
        ]),
      );

      await sut.onEnd();

      expect(readManifest().screenshots).toEqual([
        { name: 'home', theme: 'light', viewport: 'desktop', file: expect.any(String) },
      ]);
      expect(readdirSync(outputDir)).toHaveLength(2);
    });

    it('keeps only the last attempt of a retried test', async () => {
      const sut = new SquintReporter({ outputDir });
      sut.onTestEnd(newTest('a'), newResult([newAttachment('squint:light:desktop:home', 'first-png')]));
      sut.onTestEnd(newTest('a'), newResult([newAttachment('squint:light:desktop:home', 'retry-png')]));

      await expect(sut.onEnd()).resolves.toBeUndefined();

      const [{ file }] = readManifest().screenshots;
      expect(readScreenshot(file)).toBe('retry-png');
    });

    it('fails the run when two tests capture the same screenshot', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sut = new SquintReporter({ outputDir });
      sut.onTestEnd(newTest('a'), newResult([newAttachment('squint:light:desktop:home', 'home-png')]));
      sut.onTestEnd(newTest('b'), newResult([newAttachment('squint:light:desktop:home', 'other-png')]));

      await expect(sut.onEnd()).resolves.toEqual({ status: 'failed' });

      expect(error).toHaveBeenCalledWith(expect.stringContaining('Duplicate screenshot: home (light, desktop)'));
      expect(existsSync(join(outputDir, 'manifest.json'))).toBe(false);
    });
  });
});

describe('screenshot', () => {
  const newPage = () => ({ screenshot: vi.fn().mockResolvedValue(Buffer.from('png')) });
  const newTestInfo = (project: { name: string; use?: object; metadata?: object }) => ({
    project: { use: {}, metadata: {}, ...project },
    attach: vi.fn().mockResolvedValue(undefined),
  });

  it.each([
    { project: { name: 'Desktop Chrome' }, attachment: 'squint:light:desktop-chrome:home' },
    { project: { name: 'mobile', use: { colorScheme: 'dark' } }, attachment: 'squint:dark:mobile:home' },
    { project: { name: 'x', metadata: { squint: { viewport: 'tablet' } } }, attachment: 'squint:light:tablet:home' },
    { project: { name: '' }, attachment: 'squint:light:default:home' },
  ])('attaches the page as $attachment', async ({ project, attachment }) => {
    const page = newPage();
    const testInfo = newTestInfo(project);

    await screenshot(page as never, testInfo as never, 'home');

    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true, animations: 'disabled' });
    expect(testInfo.attach).toHaveBeenCalledWith(attachment, { body: Buffer.from('png'), contentType: 'image/png' });
  });
});
