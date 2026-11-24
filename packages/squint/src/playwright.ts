import type { Page, TestInfo } from '@playwright/test';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { Constants } from './constants.js';
import { ScreenshotTheme } from './enum.js';
import { SquintError } from './errors.js';
import { StorageRepository } from './repositories/storage.repository.js';
import { getAttachmentName, ReportService, type ReportAttachment } from './services/report.service.js';
import { toSlug } from './utils.js';

export type ScreenshotOptions = Parameters<Page['screenshot']>[0];
export type SquintReporterOptions = { outputDir?: string };

export const screenshot = async (page: Page, testInfo: TestInfo, name: string, options: ScreenshotOptions = {}) => {
  const body = await page.screenshot({ ...Constants.Playwright.ScreenshotOptions, ...options });
  const { project } = testInfo;
  const theme = project.use.colorScheme === ScreenshotTheme.Dark ? ScreenshotTheme.Dark : ScreenshotTheme.Light;
  const viewport = project.metadata.squint?.viewport ?? (toSlug(project.name) || Constants.Playwright.DefaultViewport);

  await testInfo.attach(getAttachmentName({ name, theme, viewport }), {
    body,
    contentType: Constants.Playwright.ContentType,
  });
};

export default class SquintReporter implements Reporter {
  private attachments = new Map<string, ReportAttachment[]>();
  private outputDir: string;
  private reportService = new ReportService(new StorageRepository());

  constructor({ outputDir = Constants.Playwright.OutputDir }: SquintReporterOptions = {}) {
    this.outputDir = outputDir;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.attachments.set(test.id, result.attachments);
  }

  async onEnd(): Promise<{ status: FullResult['status'] } | undefined> {
    try {
      await this.reportService.write(this.outputDir, Array.from(this.attachments.values()).flat());
    } catch (error) {
      if (!(error instanceof SquintError)) {
        throw error;
      }

      console.error(`Squint report failed: ${error.message}`);
      return { status: 'failed' };
    }
  }

  printsToStdio() {
    return false;
  }
}
