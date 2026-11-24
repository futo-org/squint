export type FileTreeNode = { name: string; path: string; children?: FileTreeNode[] };

type Folder = { folders: Map<string, Folder>; files: string[] };

export const buildFileTree = (paths: string[], search = ''): FileTreeNode[] => {
  const needle = search.trim().toLowerCase();
  const root: Folder = { folders: new Map(), files: [] };
  for (const path of paths) {
    if (needle && !path.toLowerCase().includes(needle)) {
      continue;
    }

    let folder = root;
    for (const segment of path.split('/').slice(0, -1)) {
      folder = getFolder(folder, segment);
    }
    folder.files.push(path);
  }
  return toNodes(root, '');
};

export const flattenFileTree = (nodes: FileTreeNode[]): string[] =>
  nodes.flatMap((node) => (node.children ? flattenFileTree(node.children) : node.path));

const getFolder = (parent: Folder, name: string) => {
  const existing = parent.folders.get(name);
  if (existing) {
    return existing;
  }

  const folder: Folder = { folders: new Map(), files: [] };
  parent.folders.set(name, folder);
  return folder;
};

const toNodes = (folder: Folder, prefix: string): FileTreeNode[] => [
  ...[...folder.folders]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, child]) => toFolderNode(name, child, prefix)),
  ...folder.files
    .map((path) => ({ name: path.slice(path.lastIndexOf('/') + 1), path }))
    .toSorted((a, b) => a.name.localeCompare(b.name)),
];

const toFolderNode = (name: string, folder: Folder, prefix: string): FileTreeNode => {
  const path = prefix ? `${prefix}/${name}` : name;
  const [onlyChild] = folder.folders.entries();
  if (folder.files.length === 0 && folder.folders.size === 1 && onlyChild) {
    const [childName, child] = onlyChild;
    const joined = toFolderNode(childName, child, path);
    return { ...joined, name: `${name}/${joined.name}` };
  }
  return { name, path, children: toNodes(folder, path) };
};
