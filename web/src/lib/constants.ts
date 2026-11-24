import {
  mdiAspectRatio,
  mdiCellphone,
  mdiFolderMultipleOutline,
  mdiInboxOutline,
  mdiMonitor,
  mdiTablet,
  mdiTrashCanOutline,
  mdiViewDashboardOutline,
} from '@mdi/js';
import type { Color } from '@immich/ui';
import type { BuildKind, PullRequestState, ReleaseNoteKind, ReviewStatus } from '@futo-org/squint-sdk';
import type { BuildFilter } from './filter.js';
import type { Screenshot } from './screens.js';

export const Constants = {
  Api: {
    Prefix: 'api',
  },
  DayMs: 86_400_000,
  IsoDateLength: 10,
  Chart: { Height: 96, PaddingX: 6, PaddingY: 10, MarkerRadius: 4, TooltipMargin: 56 },
  AvatarSizes: { small: 'size-9', large: 'size-14', giant: 'size-24' },
  NotFoundStatuses: new Set([400, 404]),
  SearchDebounceMs: 250,
  AnyOption: 'any',
  ReviewLabels: {
    'needs-review': 'Needs review',
    approved: 'Approved',
    unchanged: 'No changes',
  } satisfies Record<ReviewStatus, string>,
  KindLabels: { main: 'Main', 'pull-request': 'Pull request', release: 'Release' } satisfies Record<BuildKind, string>,
  PullRequestStateLabels: {
    open: 'Open',
    merged: 'Merged',
    closed: 'Closed',
  } satisfies Record<PullRequestState, string>,
  PullRequestStateColors: {
    open: 'primary',
    merged: 'success',
    closed: 'secondary',
  } satisfies Record<PullRequestState, Color>,
  LastSeenVersionKey: 'squint-last-seen-version',
  ShortCommitLength: 8,
  ReleaseNoteColors: { feature: 'primary', fix: 'secondary' } satisfies Record<ReleaseNoteKind, Color>,
  Live: {
    Path: '/api/socket.io',
    ChangeEvent: 'change',
  },
  Sections: [
    { href: '/', title: 'Projects', icon: mdiFolderMultipleOutline, paths: ['/', '/projects'] },
    { href: '/inbox', title: 'Inbox', icon: mdiInboxOutline, paths: ['/inbox'] },
    { href: '/dashboard', title: 'Dashboard', icon: mdiViewDashboardOutline, paths: ['/dashboard'] },
    { href: '/trash', title: 'Trash', icon: mdiTrashCanOutline, paths: ['/trash'] },
  ],
  InboxPath: '/inbox',
  BuildFilterFields: ['review', 'kind', 'branch'] as Array<keyof BuildFilter>,
  TrashFilterFields: ['kind', 'pullRequestState', 'branch'] as Array<keyof BuildFilter>,
  TrashRetentionDays: 30,
  DashboardDays: 90,
  History: {
    DefaultTheme: 'light',
    DefaultViewport: 'desktop',
    OlderKeys: ['ArrowLeft', 'k'],
    NewerKeys: ['ArrowRight', 'j'],
  },
  StatusBadgeColors: {
    changed: 'warning',
    new: 'success',
    removed: 'danger',
    unchanged: 'secondary',
  } satisfies Record<Screenshot['status'], Color>,
  CompareKeyStep: 5,
  MinPercentRatio: 0.0001,
  Diff: {
    RegionPadding: 4,
  },
  RelativeTimeUnits: [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ] as Array<[Intl.RelativeTimeFormatUnit, number]>,
  ViewportIcons: { desktop: mdiMonitor, phone: mdiCellphone, tablet: mdiTablet } as Record<string, string>,
  ViewportFallbackIcon: mdiAspectRatio,
  WideScreenQuery: 'min-width: 768px',
  SurfaceClass: 'bg-light dark:bg-light-100',
  ListClass: 'flex flex-col divide-y border bg-light-100',
  BannerClass: '[&_.immich-scrollbar]:px-4 [&_.immich-scrollbar]:py-1.5 text-sm',
  Review: {
    NextKeys: ['j', 'ArrowRight'],
    PreviousKeys: ['k', 'ArrowLeft'],
    ApproveKey: 'a',
    ProgressMinItems: 3,
  },
  ImageClass: 'block h-auto w-auto max-w-full max-h-[75vh]',
  FrameClass: 'relative w-fit max-w-full overflow-hidden rounded-lg border',
  ToggleGroupClass: 'flex items-center rounded-full bg-light-200 p-0.5',
  BorderClass: 'border-gray-200 dark:border-white/10',
  StatusColors: {
    changed: 'text-warning',
    new: 'text-success',
    removed: 'text-danger',
    unchanged: 'text-muted',
  } satisfies Record<Screenshot['status'], string>,
};
