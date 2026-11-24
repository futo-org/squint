type Variant = { theme: string; viewport: string };

export const getVariants = <T extends Variant>(versions: T[]) => ({
  themes: [...new Set(versions.map(({ theme }) => theme))],
  viewports: [...new Set(versions.map(({ viewport }) => viewport))],
});

export const getTimeline = <T extends Variant>(versions: T[], { theme, viewport }: Partial<Variant>): T[] => {
  const anchor =
    versions.find((version) => version.theme === theme && version.viewport === viewport) ??
    versions.find((version) => version.theme === theme) ??
    versions.find((version) => version.viewport === viewport) ??
    versions[0];
  if (!anchor) {
    return [];
  }

  return versions.filter((version) => version.theme === anchor.theme && version.viewport === anchor.viewport);
};
