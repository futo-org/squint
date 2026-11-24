import { type ReviewScreenshotResponseDto, ScreenshotStatus } from '@futo-org/squint-sdk';
import { buildFileTree, flattenFileTree } from './file-tree.js';

export type Screenshot = ReviewScreenshotResponseDto;

export type Screen = {
  name: string;
  variants: Screenshot[];
  status: Screenshot['status'];
  pending: number;
};

const statusOrder = [ScreenshotStatus.Changed, ScreenshotStatus.New, ScreenshotStatus.Removed];

export const isChanged = ({ status }: Pick<Screenshot, 'status'>) => status !== ScreenshotStatus.Unchanged;

const isPending = (screenshot: Screenshot) => isChanged(screenshot) && !screenshot.approval;

export const groupScreens = (screenshots: Screenshot[]): Screen[] => {
  const changed = new Set(screenshots.filter((screenshot) => isChanged(screenshot)).map(({ name }) => name));
  const groups = Map.groupBy(
    screenshots.filter(({ name }) => changed.has(name)),
    ({ name }) => name,
  );
  const screens = Array.from(groups, ([name, variants]) => ({
    name,
    variants,
    status: statusOrder.find((status) => variants.some((variant) => variant.status === status)) ?? variants[0].status,
    pending: variants.filter((variant) => isPending(variant)).length,
  }));

  const order = flattenFileTree(buildFileTree(groups.keys().toArray()));

  return screens.toSorted((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
};

export const pickVariant = (screen: Screen, { theme, viewport }: { theme: string; viewport: string }) =>
  screen.variants.find((variant) => variant.theme === theme && variant.viewport === viewport) ??
  screen.variants.find((variant) => variant.viewport === viewport) ??
  screen.variants[0];

export const getNextScreen = (screens: Screen[], currentName: string, { isApproving }: { isApproving: boolean }) => {
  if (isApproving) {
    return getNextToReview(screens, currentName);
  }

  return screens[screens.findIndex(({ name }) => name === currentName) + 1];
};

export const getNextToReview = (screens: Screen[], currentName: string) => {
  const index = screens.findIndex(({ name }) => name === currentName);
  const ordered = [...screens.slice(index + 1), ...screens.slice(0, index)];

  return ordered.find(({ pending }) => pending > 0);
};

export const getScreenApproval = ({ variants, pending }: Screen) => {
  if (pending > 0) {
    return;
  }

  return variants
    .map(({ approval }) => approval)
    .filter((approval) => approval !== null)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
};
