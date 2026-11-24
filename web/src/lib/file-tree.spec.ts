import { describe, expect, it } from 'vitest';
import { buildFileTree, flattenFileTree } from './file-tree.js';

describe(buildFileTree.name, () => {
  it('nests files under their folders with folders first, then files, each alphabetical', () => {
    expect(buildFileTree(['web/b.ts', 'README.md', 'server/a.ts', 'web/lib/c.ts', 'web/a.ts'])).toEqual([
      { name: 'server', path: 'server', children: [{ name: 'a.ts', path: 'server/a.ts' }] },
      {
        name: 'web',
        path: 'web',
        children: [
          { name: 'lib', path: 'web/lib', children: [{ name: 'c.ts', path: 'web/lib/c.ts' }] },
          { name: 'a.ts', path: 'web/a.ts' },
          { name: 'b.ts', path: 'web/b.ts' },
        ],
      },
      { name: 'README.md', path: 'README.md' },
    ]);
  });

  it('joins folders that only hold one folder into a single row', () => {
    expect(buildFileTree(['web/src/lib/components/A.svelte', 'web/src/lib/components/B.svelte'])).toEqual([
      {
        name: 'web/src/lib/components',
        path: 'web/src/lib/components',
        children: [
          { name: 'A.svelte', path: 'web/src/lib/components/A.svelte' },
          { name: 'B.svelte', path: 'web/src/lib/components/B.svelte' },
        ],
      },
    ]);
  });

  it('keeps only files whose path matches the search, ignoring case', () => {
    expect(buildFileTree(['web/Table.svelte', 'web/Card.svelte', 'server/table.ts'], 'TABLE')).toEqual([
      { name: 'server', path: 'server', children: [{ name: 'table.ts', path: 'server/table.ts' }] },
      { name: 'web', path: 'web', children: [{ name: 'Table.svelte', path: 'web/Table.svelte' }] },
    ]);
  });

  it('is empty when nothing matches', () => {
    expect(buildFileTree(['web/a.ts'], 'zzz')).toEqual([]);
  });
});

describe(flattenFileTree.name, () => {
  it('lists the files in the order the tree shows them', () => {
    const tree = buildFileTree(['web/b.ts', 'README.md', 'server/a.ts', 'web/lib/c.ts', 'web/a.ts']);

    expect(flattenFileTree(tree)).toEqual(['server/a.ts', 'web/lib/c.ts', 'web/a.ts', 'web/b.ts', 'README.md']);
  });
});
