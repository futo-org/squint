<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import BackBar from '#lib/components/BackBar.svelte';
  import IconToggleGroup from '#lib/components/IconToggleGroup.svelte';
  import RelativeTime from '#lib/components/RelativeTime.svelte';
  import ReviewPage from '#lib/components/ReviewPage.svelte';
  import ReviewTree from '#lib/components/ReviewTree.svelte';
  import ScreenshotView from '#lib/components/ScreenshotView.svelte';
  import { Constants } from '#lib/constants.js';
  import { formatPercent } from '#lib/format.js';
  import { approveBuildScreenMutation, getBuildQuery, revokeBuildScreenMutation } from '#lib/queries/build.query.js';
  import { createPreloadedQuery } from '#lib/queries/client.js';
  import { getMyUserQuery } from '#lib/queries/user.query.js';
  import {
    getNextScreen,
    getNextToReview,
    getScreenApproval,
    groupScreens,
    isChanged,
    pickVariant,
  } from '#lib/screens.js';
  import { Alert, Badge, Button, IconButton, Text } from '@immich/ui';
  import { BuildKind, ScreenshotStatus, ScreenshotTheme, UserRole } from '@futo-org/squint-sdk';
  import {
    mdiCheckboxBlankOutline,
    mdiCheckboxMarked,
    mdiCompare,
    mdiHistory,
    mdiImageMultipleOutline,
    mdiVectorDifference,
    mdiWeatherNight,
    mdiWeatherSunny,
  } from '@mdi/js';
  import { createMutation } from '@tanstack/svelte-query';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };
  type Mode = 'side-by-side' | 'slider';

  const { data }: Props = $props();

  const build = createPreloadedQuery(() => getBuildQuery(data.id));
  const user = createPreloadedQuery(getMyUserQuery);
  const approve = createMutation(approveBuildScreenMutation);
  const revoke = createMutation(revokeBuildScreenMutation);

  const modes: Array<{ value: Mode; label: string; icon: string }> = [
    { value: 'side-by-side', label: 'Side by side', icon: mdiImageMultipleOutline },
    { value: 'slider', label: 'Slider', icon: mdiCompare },
  ];

  const themes = [
    { value: ScreenshotTheme.Light, label: 'Light screenshots', icon: mdiWeatherSunny },
    { value: ScreenshotTheme.Dark, label: 'Dark screenshots', icon: mdiWeatherNight },
  ];

  let theme = $state(ScreenshotTheme.Light);
  let viewport = $state('desktop');
  let mode = $state<Mode>('side-by-side');
  let isDiffOn = $state(true);
  let isDiffPreviewed = $state(false);

  const isSaving = $derived(approve.isPending || revoke.isPending);
  const screens = $derived(groupScreens(build.data.screenshots));
  const unchangedCount = $derived(new Set(build.data.screenshots.map(({ name }) => name)).size - screens.length);
  const selected = $derived(page.url.searchParams.get('screen'));
  const screen = $derived(
    screens.find(({ name }) => name === selected) ?? screens.find(({ pending }) => pending > 0) ?? screens[0],
  );
  const index = $derived(Math.max(0, screens.indexOf(screen)));
  const screenshot = $derived(screen && pickVariant(screen, { theme, viewport }));
  const viewports = $derived([...new Set(screen?.variants.map((variant) => variant.viewport))]);
  const hasThemes = $derived(new Set(screen?.variants.map((variant) => variant.theme)).size > 1);
  const isApprover = $derived(user.data.role === UserRole.Approver);
  const canApprove = $derived(isApprover && !!screen);
  const approval = $derived(screen && getScreenApproval(screen));
  const canCompare = $derived(!!screenshot && isChanged(screenshot) && !!screenshot.baselineSha256);
  const label = $derived(
    build.data.pullRequest ? `#${build.data.pullRequest.number}` : (build.data.release ?? build.data.kind),
  );

  const description = $derived(`${label} · ${build.data.branch} · ${build.data.commit.slice(0, 8)}`);

  const handleBack = () => goto(`/projects/${build.data.projectId}`);

  const open = (name: string) => goto(`?screen=${encodeURIComponent(name)}`, { replace: true, reset: false });

  const handleApproved = async (approved: boolean) => {
    if (!screen || isSaving) {
      return;
    }

    const next = approved ? getNextToReview(screens, screen.name) : undefined;
    const { id } = build.data;
    await (approved
      ? approve.mutateAsync([{ id, approvalDto: { name: screen.name } }])
      : revoke.mutateAsync([{ id, name: screen.name }]));

    if (next) {
      await open(next.name);
    }
  };

  const handleDiffToggle = () => {
    isDiffOn = !isDiffOn;
    isDiffPreviewed = false;
  };

  const handleNext = async () => {
    if (!screen || isSaving) {
      return;
    }

    const isApproving = canApprove && !approval;
    const next = getNextScreen(screens, screen.name, { isApproving });
    if (isApproving) {
      await handleApproved(true);
    } else if (next) {
      await open(next.name);
    }

    if (!next) {
      await handleBack();
    }
  };
</script>

<svelte:head>
  <title>{screen?.name ?? 'Build'} - Squint</title>
</svelte:head>

{#snippet badge()}
  <Badge size="small" color={build.data.kind === BuildKind.Main ? 'secondary' : 'primary'}>{label}</Badge>
{/snippet}

{#if !screen || !screenshot}
  <main>
    <BackBar title="Review" {description} titleSuffix={badge} onBack={handleBack} />
    <div class="p-8">
      <Text color="muted">
        {unchangedCount > 0 ? `No visual changes in ${unchangedCount} screens.` : 'This build has no screenshots.'}
      </Text>
    </div>
  </main>
{:else}
  <ReviewPage
    {description}
    items={screens.map(({ pending }) => ({ done: pending === 0 }))}
    {index}
    canApprove={isApprover}
    isMarking={isSaving}
    nextLabel={canApprove && !approval ? 'Approve' : 'Next'}
    onPage={(target) => open(screens[target].name)}
    onBack={handleBack}
    onNext={handleNext}
    onToggle={() => canApprove && handleApproved(!approval)}
    titleSuffix={badge}
  >
    {#snippet header()}
      <span class="line-clamp-2 font-mono text-sm font-semibold wrap-anywhere text-black dark:text-white">
        {screen.name}
      </span>
      {#if screenshot.diffRatio !== null}
        <Text size="tiny" color="muted" class="tabular-nums">{formatPercent(screenshot.diffRatio)} changed</Text>
      {/if}
    {/snippet}
    {#snippet toolbar()}
      {#if viewports.length > 1}
        <IconToggleGroup
          label="Viewport"
          items={viewports.map((item) => ({
            value: item,
            label: item,
            icon: Constants.ViewportIcons[item] ?? Constants.ViewportFallbackIcon,
          }))}
          value={screenshot.viewport}
          onChange={(item) => (viewport = item)}
        />
      {/if}
      {#if canCompare}
        <IconToggleGroup label="View" items={modes} value={mode} onChange={(item) => (mode = item)} />
      {/if}
      {#if screenshot.diffSha256}
        <div class={Constants.ToggleGroupClass}>
          <IconButton
            icon={mdiVectorDifference}
            aria-label="Highlight changes"
            title="Highlight changes"
            aria-pressed={isDiffOn}
            variant={isDiffOn ? 'filled' : 'ghost'}
            color="secondary"
            shape="round"
            size="small"
            onclick={handleDiffToggle}
            onpointerenter={(event: PointerEvent) => (isDiffPreviewed = event.pointerType === 'mouse')}
            onpointerleave={() => (isDiffPreviewed = false)}
          />
        </div>
      {/if}
      {#if screenshot.status !== ScreenshotStatus.New}
        <div class={Constants.ToggleGroupClass}>
          <IconButton
            href="/projects/{build.data.projectId}/history?screen={encodeURIComponent(screen.name)}"
            icon={mdiHistory}
            aria-label="Screen history"
            title="Screen history"
            variant="ghost"
            color="secondary"
            shape="round"
            size="small"
          />
        </div>
      {/if}
      {#if hasThemes}
        <IconToggleGroup label="Theme" items={themes} value={screenshot.theme} onChange={(item) => (theme = item)} />
      {/if}
      <Button
        size="small"
        shape="round"
        color="primary"
        variant={approval ? 'filled' : 'outline'}
        leadingIcon={approval ? mdiCheckboxMarked : mdiCheckboxBlankOutline}
        aria-pressed={!!approval}
        disabled={!isApprover || isSaving}
        onclick={() => handleApproved(!approval)}
      >
        {approval ? 'Approved' : isApprover ? 'Approve' : 'Not approved'}
      </Button>
    {/snippet}
    {#snippet sidebar({ onClose }: { onClose?: () => void })}
      <ReviewTree {screens} current={screen.name} {unchangedCount} {onClose} />
    {/snippet}
    {#if build.data.expiresAt}
      <Alert color="warning" shape="rectangle" size="small" class={Constants.BannerClass}>
        <span>In the trash, its screenshots will be deleted <RelativeTime date={build.data.expiresAt} /></span>
      </Alert>
    {/if}
    {#if approval}
      <Alert color="primary" shape="rectangle" size="small" class={Constants.BannerClass}>
        <span>Approved by {approval.userName} <RelativeTime date={approval.createdAt} /></span>
      </Alert>
    {/if}
    <div class="p-4">
      <ScreenshotView {screenshot} mode={canCompare ? mode : 'single'} showDiff={isDiffOn || isDiffPreviewed} />
    </div>
  </ReviewPage>
{/if}
