import { Constants } from 'src/constants.js';
import type { ReleaseNoteKind } from 'src/enum.js';

export type Commit = { subject: string; date: string };

export type ReleaseNote = { kind: ReleaseNoteKind; text: string };

export type Release = { version: string; date: string; notes: ReleaseNote[] };

const { ConventionalSubject, NoteKinds, VersionCommit } = Constants.Release;

export const toRelease = (commits: Commit[], version: string): Release | undefined => {
  const notes = new Map<string, ReleaseNote>();
  let date = '';
  for (const commit of commits) {
    if (VersionCommit.test(commit.subject)) {
      break;
    }

    const note = toNote(commit.subject);
    if (!note) {
      continue;
    }

    notes.set(note.text, note);
    date ||= commit.date;
  }

  if (notes.size === 0) {
    return;
  }

  return {
    version,
    date,
    notes: notes
      .values()
      .toArray()
      .toSorted((a, b) => a.kind.localeCompare(b.kind)),
  };
};

export const addRelease = (releases: Release[], release: Release) => [
  release,
  ...releases.filter(({ version }) => version !== release.version),
];

const toNote = (subject: string): ReleaseNote | undefined => {
  const [, type, text] = ConventionalSubject.exec(subject) ?? [];
  const kind = NoteKinds.get(type);
  if (!kind) {
    return;
  }

  return { kind, text: text.charAt(0).toUpperCase() + text.slice(1) };
};
