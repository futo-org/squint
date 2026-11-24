#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { Constants } from './constants.js';
import { SquintError } from './errors.js';
import { ApiRepository } from './repositories/api.repository.js';
import { GithubRepository } from './repositories/github.repository.js';
import { OdiffRepository } from './repositories/odiff.repository.js';
import { PngRepository } from './repositories/png.repository.js';
import { StorageRepository } from './repositories/storage.repository.js';
import { DiffService } from './services/diff.service.js';
import { PublishService } from './services/publish.service.js';

const main = async () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { project: { type: 'string' }, release: { type: 'string' }, server: { type: 'string' } },
  });
  const [command, directory] = positionals;
  if (command !== 'publish' || !directory || !values.project) {
    throw new SquintError(Constants.Cli.Usage);
  }

  const pngRepository = new PngRepository();
  const service = new PublishService(
    new ApiRepository(),
    new GithubRepository(),
    new StorageRepository(),
    pngRepository,
    new DiffService(new OdiffRepository(), pngRepository),
  );
  const { build, counts, uploaded, url } = await service.publish({
    directory,
    project: values.project,
    release: values.release,
    server: values.server ?? process.env[Constants.Publish.ServerEnv] ?? Constants.Publish.DefaultServer,
  });
  const summary = Object.entries(counts).map(([status, count]) => `${count} ${status}`);
  console.log(`Published ${build.kind} build ${build.id}: ${[...summary, `${uploaded} uploaded`].join(', ')}`);
  console.log(url);
};

const isExpected = (error: unknown) =>
  error instanceof SquintError ||
  (error instanceof TypeError && 'code' in error && error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION');

try {
  await main();
} catch (error) {
  console.error(isExpected(error) ? `Error: ${(error as Error).message}` : error);
  process.exitCode = 1;
}
