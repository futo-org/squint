import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Constants } from 'src/constants.js';

@Injectable()
export class ErrorReportingRepository {
  init({ dsn, environment }: { dsn?: string; environment?: string }): void {
    if (!dsn) {
      return;
    }

    Sentry.init({ dsn, environment, release: Constants.App.Version });
  }

  report(error: unknown): void {
    Sentry.captureException(error);
  }

  flush(): Promise<boolean> {
    return Sentry.flush(Constants.ErrorReporting.FlushTimeoutMs);
  }
}
