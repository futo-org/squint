import { ReleaseNoteKind } from 'src/enum.js';
import { addRelease, toRelease, type Commit } from 'src/utils/release-notes.js';

const newCommit = (subject: string, date = '2026-11-18T10:00:00-05:00'): Commit => ({ subject, date });

describe(toRelease.name, () => {
  it('collects the features and fixes since the last version', () => {
    const commits = [
      newCommit('fix: approve button on phones', '2026-11-18T12:00:00-05:00'),
      newCommit('feat: review inbox', '2026-11-17T09:00:00-05:00'),
      newCommit('chore: version 0.1.0'),
      newCommit('feat: project cards'),
    ];

    expect(toRelease(commits, '0.2.0')).toEqual({
      version: '0.2.0',
      date: '2026-11-18T12:00:00-05:00',
      notes: [
        { kind: ReleaseNoteKind.Feature, text: 'Review inbox' },
        { kind: ReleaseNoteKind.Fix, text: 'Approve button on phones' },
      ],
    });
  });

  it('collects everything when there is no earlier version', () => {
    const commits = [newCommit('feat: dashboard'), newCommit('feat: squint app')];

    expect(toRelease(commits, '0.1.0')?.notes).toEqual([
      { kind: ReleaseNoteKind.Feature, text: 'Dashboard' },
      { kind: ReleaseNoteKind.Feature, text: 'Squint app' },
    ]);
  });

  it.each([
    { subject: 'feat(web): filter chips', expected: { kind: ReleaseNoteKind.Feature, text: 'Filter chips' } },
    { subject: 'feat!: remove disk storage', expected: { kind: ReleaseNoteKind.Feature, text: 'Remove disk storage' } },
    { subject: 'fix(server)!: trash order', expected: { kind: ReleaseNoteKind.Fix, text: 'Trash order' } },
    { subject: 'perf: faster build search', expected: { kind: ReleaseNoteKind.Fix, text: 'Faster build search' } },
  ])('turns "$subject" into a note', ({ subject, expected }) => {
    expect(toRelease([newCommit(subject)], '0.2.0')?.notes).toEqual([expected]);
  });

  it.each(['chore: bump dependencies', 'refactor: build queries', 'docs: readme', 'test: inbox', 'ci: docker', 'wip'])(
    'leaves out "%s"',
    (subject) => {
      expect(toRelease([newCommit(subject), newCommit('feat: dashboard')], '0.2.0')?.notes).toEqual([
        { kind: ReleaseNoteKind.Feature, text: 'Dashboard' },
      ]);
    },
  );

  it('lists a repeated change once', () => {
    const commits = [newCommit('fix: sidebar width'), newCommit('fix: sidebar width')];

    expect(toRelease(commits, '0.2.0')?.notes).toEqual([{ kind: ReleaseNoteKind.Fix, text: 'Sidebar width' }]);
  });

  it('returns nothing when no change is worth a note', () => {
    const commits = [newCommit('chore: bump dependencies'), newCommit('chore: version 0.1.0'), newCommit('feat: old')];

    expect(toRelease(commits, '0.2.0')).toBeUndefined();
  });

  it('does not stop at a commit that only mentions a version', () => {
    const commits = [newCommit('fix: version 2 of the parser'), newCommit('feat: dashboard')];

    expect(toRelease(commits, '0.2.0')?.notes).toHaveLength(2);
  });
});

describe(addRelease.name, () => {
  const first = { version: '0.1.0', date: '2026-11-01T00:00:00Z', notes: [] };
  const second = { version: '0.2.0', date: '2026-11-18T00:00:00Z', notes: [] };

  it('puts the newest release first', () => {
    expect(addRelease([first], second)).toEqual([second, first]);
  });

  it('replaces a release that is generated again', () => {
    const regenerated = { ...second, notes: [{ kind: ReleaseNoteKind.Fix, text: 'Sidebar width' }] };

    expect(addRelease([second, first], regenerated)).toEqual([regenerated, first]);
  });
});
