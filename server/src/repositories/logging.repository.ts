import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggingRepository {
  private logger = new Logger('Squint');

  log(message: string): void {
    this.logger.log(message);
  }

  warn(message: string, cause?: unknown): void {
    this.logger.warn(cause ? `${message}: ${String(cause)}` : message);
  }

  error(message: string, error?: unknown): void {
    this.logger.error(message, error instanceof Error ? error.stack : error);
  }
}
