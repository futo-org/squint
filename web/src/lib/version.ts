const toParts = (version: string) => version.split('.').map((part) => Math.trunc(Number(part)) || 0);

export const isNewerVersion = (candidate: string, current: string) => {
  const [a, b] = [toParts(candidate), toParts(current)];
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }

  return false;
};

export const getUnseenReleases = <T extends { version: string }>(
  releases: T[],
  { lastSeen, current }: { lastSeen: string; current: string },
) => releases.filter(({ version }) => isNewerVersion(version, lastSeen) && !isNewerVersion(version, current));
