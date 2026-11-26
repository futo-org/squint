<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import IconToggleGroup from '#lib/components/IconToggleGroup.svelte';
  import RelativeTime from '#lib/components/RelativeTime.svelte';
  import ScreenshotView from '#lib/components/ScreenshotView.svelte';
  import { Constants } from '#lib/constants.js';
  import { toSearch } from '#lib/filter.js';
  import { formatDay, formatPercent } from '#lib/format.js';
  import { getTimeline, getVariants } from '#lib/history.js';
  import { createPreloadedQuery } from '#lib/queries/client.js';
  import { getProjectQuery } from '#lib/queries/project.query.js';
  import { searchScreenshotVersionsQuery } from '#lib/queries/screen.query.js';
  import { Badge, Button, IconButton, Link, Text } from '@immich/ui';
  import {
    mdiArrowLeft,
    mdiArrowRight,
    mdiCompare,
    mdiImageMultipleOutline,
    mdiImageOutline,
    mdiVectorDifference,
    mdiWeatherNight,
    mdiWeatherSunny,
  } from '@mdi/js';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };
  type Mode = 'single' | 'side-by-side' | 'slider';

  const { data }: Props = $props();

  const modes: Array<{ value: Mode; label: string; icon: string }> = [
    { value: 'single', label: 'This version', icon: mdiImageOutline },
    { value: 'side-by-side', label: 'Side by side with the version before', icon: mdiImageMultipleOutline },
    { value: 'slider', label: 'Slider with the version before', icon: mdiCompare },
  ];
  const themeIcons: Record<string, string> = { light: mdiWeatherSunny, dark: mdiWeatherNight };

  let mode = $state<Mode>('single');
  let isDiffOn = $state(true);

  const { projectId, name } = $derived(data);
  const project = createPreloadedQuery(() => getProjectQuery(projectId));
  const versions = createPreloadedQuery(() => searchScreenshotVersionsQuery({ projectId, name }));
  const base = $derived(`/projects/${projectId}`);
  const params = $derived(page.url.searchParams);
  const variants = $derived(getVariants(versions.data));
  const timeline = $derived(
    getTimeline(versions.data, {
      theme: params.get('theme') ?? Constants.History.DefaultTheme,
      viewport: params.get('viewport') ?? Constants.History.DefaultViewport,
    }),
  );
  const index = $derived(
    Math.max(
      0,
      timeline.findIndex(({ id }) => id === params.get('version')),
    ),
  );
  const version = $derived(timeline[index]);
  const canCompare = $derived(!!version.baselineSha256 && !!version.sha256);

  const open = (change: { theme?: string; viewport?: string; version?: string }) => {
    const { theme, viewport } = version;

    return goto(`${base}/history${toSearch({ screen: name, theme, viewport, ...change })}`, {
      replace: true,
      reset: false,
    });
  };

  const openAt = (target: number) => {
    const next = timeline[target];
    if (next) {
      void open({ version: next.id });
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (Constants.History.OlderKeys.includes(event.key)) {
      openAt(index + 1);
    } else if (Constants.History.NewerKeys.includes(event.key)) {
      openAt(index - 1);
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>{name} history - {project.data.name} - Squint</title>
</svelte:head>

<BreadcrumbPage
  breadcrumbs={[
    { title: 'Projects', href: '/' },
    { title: project.data.name, href: base },
    { title: 'Screens', href: `${base}/screens` },
    { title: name },
  ]}
>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex flex-wrap items-center gap-2">
        <Text fontWeight="medium" class="tabular-nums">Version {timeline.length - index} of {timeline.length}</Text>
        <Badge size="tiny" color={Constants.StatusBadgeColors[version.status]}>{version.status}</Badge>
        {#if version.diffRatio !== null}
          <Text size="tiny" color="muted" class="tabular-nums">{formatPercent(version.diffRatio)} changed</Text>
        {/if}
      </div>
      <Text size="small" color="muted">
        {formatDay(version.createdAt)}, <RelativeTime date={version.createdAt} /> ·
        <Link href={version.commitUrl} target="_blank" rel="noreferrer" class="font-mono">
          {version.commit.slice(0, Constants.ShortCommitLength)}
        </Link>
      </Text>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if variants.viewports.length > 1}
        <IconToggleGroup
          label="Viewport"
          items={variants.viewports.map((item) => ({
            value: item,
            label: item,
            icon: Constants.ViewportIcons[item] ?? Constants.ViewportFallbackIcon,
          }))}
          value={version.viewport}
          onChange={(viewport) => open({ viewport, version: undefined })}
        />
      {/if}
      {#if variants.themes.length > 1}
        <IconToggleGroup
          label="Theme"
          items={variants.themes.map((item) => ({
            value: item,
            label: `${item} screenshots`,
            icon: themeIcons[item] ?? mdiWeatherSunny,
          }))}
          value={version.theme}
          onChange={(theme) => open({ theme, version: undefined })}
        />
      {/if}
      {#if canCompare}
        <IconToggleGroup label="View" items={modes} value={mode} onChange={(item) => (mode = item)} />
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
            disabled={!version.diffSha256 || mode === 'single'}
            onclick={() => (isDiffOn = !isDiffOn)}
          />
        </div>
      {/if}
    </div>
  </div>

  <ScreenshotView screenshot={version} mode={canCompare ? mode : 'single'} showDiff={isDiffOn && mode !== 'single'} />

  <div class="flex items-center justify-between gap-3">
    <Button
      size="small"
      shape="round"
      color="secondary"
      leadingIcon={mdiArrowLeft}
      disabled={index >= timeline.length - 1}
      onclick={() => openAt(index + 1)}
    >
      Older
    </Button>
    <Button
      size="small"
      shape="round"
      color="secondary"
      trailingIcon={mdiArrowRight}
      disabled={index === 0}
      onclick={() => openAt(index - 1)}
    >
      Newer
    </Button>
  </div>

  <ol aria-label="Versions" class={Constants.ListClass}>
    {#each timeline as item, position (item.id)}
      <li>
        <button
          type="button"
          class={[
            'flex w-full items-center gap-3 py-2 ps-4 pe-3 text-start hover:bg-light-200',
            position === index && 'bg-primary/10',
          ]}
          aria-current={position === index ? 'true' : undefined}
          onclick={() => openAt(position)}
        >
          <Text size="small" class="w-8 shrink-0 text-muted tabular-nums">{timeline.length - position}</Text>
          <Badge size="tiny" color={Constants.StatusBadgeColors[item.status]} class="shrink-0">{item.status}</Badge>
          <Text size="small" class="min-w-0 flex-1 truncate">{formatDay(item.createdAt)}</Text>
          {#if item.diffRatio !== null}
            <Text size="tiny" color="muted" class="shrink-0 tabular-nums">{formatPercent(item.diffRatio)}</Text>
          {/if}
          <Text size="tiny" color="muted" class="shrink-0 font-mono">
            {item.commit.slice(0, Constants.ShortCommitLength)}
          </Text>
        </button>
      </li>
    {/each}
  </ol>
</BreadcrumbPage>
