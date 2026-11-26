import { ErrorReportingRepository } from 'src/repositories/error-reporting.repository.js';

new ErrorReportingRepository().init({ dsn: process.env.SQUINT_SENTRY_DSN, environment: process.env.NODE_ENV });
