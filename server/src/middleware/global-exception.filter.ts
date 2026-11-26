import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ErrorReportingRepository } from 'src/repositories/error-reporting.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<Error> {
  constructor(
    private logger: LoggingRepository,
    private errorReporting: ErrorReportingRepository,
  ) {}

  catch(error: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) {
      return;
    }

    const { status, body } = this.fromError(error);

    response.status(status).json(body);
  }

  private fromError(error: Error) {
    if (!(error instanceof HttpException)) {
      this.logger.error('Unhandled error', error);
      this.errorReporting.report(error);

      return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { message: 'Internal server error' } };
    }

    if (error.cause) {
      this.logger.warn(error.message, error.cause);
    }

    const response = error.getResponse();
    const body: Record<string, unknown> = typeof response === 'string' ? { message: response } : { ...response };
    delete body.error;
    delete body.statusCode;

    return { status: error.getStatus(), body };
  }
}
