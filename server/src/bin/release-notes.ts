import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Constants } from 'src/constants.js';
import { addRelease, toRelease, type Commit, type Release } from 'src/utils/release-notes.js';

const { values } = parseArgs({ options: { next: { type: 'string' }, out: { type: 'string' } } });
const { next, out } = values;
if (!next) {
  throw new Error('Pass --next <version> [--out <file>]');
}

const { GitLogMaxBytes, GitLogRecordSeparator } = Constants.Release;
const log = execFileSync('git', ['log', '--first-parent', `--format=${GitLogRecordSeparator}%s%x09%aI`], {
  encoding: 'utf8',
  maxBuffer: GitLogMaxBytes,
});
const commits: Commit[] = log
  .split(GitLogRecordSeparator)
  .filter(Boolean)
  .map((record) => {
    const [subject, date] = record.trim().split('\t', 2);

    return { subject, date };
  });

const release = toRelease(commits, next);
if (!out) {
  console.log(JSON.stringify(release ?? null, undefined, 2));
} else if (release) {
  const releases = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as Release[]) : [];
  writeFileSync(out, `${JSON.stringify(addRelease(releases, release), undefined, 2)}\n`);
}
