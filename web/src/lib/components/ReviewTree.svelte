<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import { buildFileTree, type FileTreeNode } from '#lib/file-tree.js';
  import type { Screen } from '#lib/screens.js';
  import { Heading, Icon, IconButton, Input, Text } from '@immich/ui';
  import { ScreenshotStatus } from '@futo-org/squint-sdk';
  import {
    mdiCheckboxBlankOutline,
    mdiCheckboxMarked,
    mdiClose,
    mdiEyeOffOutline,
    mdiFolderOutline,
    mdiImageOutline,
    mdiImagePlusOutline,
    mdiImageRemoveOutline,
    mdiMagnify,
  } from '@mdi/js';

  type Props = { screens: Screen[]; current: string; unchangedCount: number; onClose?: () => void };

  const { screens, current, unchangedCount, onClose }: Props = $props();

  const statusIcons: Partial<Record<Screen['status'], string>> = {
    new: mdiImagePlusOutline,
    removed: mdiImageRemoveOutline,
  };

  let search = $state('');
  let onlyUnreviewed = $state(false);
  let list = $state<HTMLElement>();

  const byName = $derived(new Map(screens.map((screen) => [screen.name, screen])));
  const names = $derived(screens.filter(({ pending }) => !onlyUnreviewed || pending > 0).map(({ name }) => name));
  const nodes = $derived(buildFileTree(names, search));

  $effect(() => {
    void current;
    list?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  });
</script>

{#snippet reviewedMark(screen: Screen)}
  {#if screen.pending > 0}
    <Icon icon={mdiCheckboxBlankOutline} size="16" class="shrink-0 text-primary" aria-hidden />
    <span class="sr-only">Not approved</span>
  {:else}
    <Icon icon={mdiCheckboxMarked} size="16" class="shrink-0 text-muted" aria-hidden />
    <span class="sr-only">Approved</span>
  {/if}
{/snippet}

{#snippet tree(entries: FileTreeNode[], depth: number)}
  {#each entries as node (node.path)}
    {@const screen = byName.get(node.path)}
    <li>
      {#if node.children}
        <div
          class="flex items-center gap-1.5 py-1 text-sm text-muted"
          style:padding-inline-start="{depth * 0.75 + 0.25}rem"
        >
          <Icon icon={mdiFolderOutline} size="16" class="shrink-0" aria-hidden />
          <span class="truncate">{node.name}</span>
        </div>
        <ul>
          {@render tree(node.children, depth + 1)}
        </ul>
      {:else if screen}
        <a
          href="?screen={encodeURIComponent(screen.name)}"
          data-sveltekit-replacestate
          data-sveltekit-reset="false"
          aria-current={screen.name === current ? 'page' : undefined}
          class="flex items-center gap-1.5 rounded-md py-1 pe-2 text-sm hover:bg-light-100 aria-[current=page]:bg-light-200 aria-[current=page]:font-semibold"
          style:padding-inline-start="{depth * 0.75 + 0.25}rem"
        >
          <Icon
            icon={statusIcons[screen.status] ?? mdiImageOutline}
            size="16"
            class="shrink-0 {Constants.StatusColors[screen.status]}"
            aria-hidden
          />
          <span class="min-w-0 grow truncate font-mono">{node.name}</span>
          {#if screen.status !== ScreenshotStatus.Changed}
            <span class="text-xs {Constants.StatusColors[screen.status]}">{screen.status}</span>
          {/if}
          {@render reviewedMark(screen)}
        </a>
      {/if}
    </li>
  {/each}
{/snippet}

<nav bind:this={list} aria-label="Screens" class="flex flex-col gap-2 p-3">
  <div class="sticky top-0 z-10 -mx-3 -mt-3 flex items-center gap-1 bg-light px-3 pt-3 pb-1">
    <Input
      class="min-w-0 grow"
      size="small"
      type="search"
      aria-label="Filter screens"
      placeholder="Filter screens"
      leadingIcon={mdiMagnify}
      bind:value={search}
    />
    <IconButton
      icon={mdiEyeOffOutline}
      aria-label="Only unreviewed screens"
      aria-pressed={onlyUnreviewed}
      shape="round"
      variant={onlyUnreviewed ? 'filled' : 'ghost'}
      color={onlyUnreviewed ? 'primary' : 'secondary'}
      size="small"
      class="shrink-0"
      onclick={() => (onlyUnreviewed = !onlyUnreviewed)}
    />
    {#if onClose}
      <IconButton
        icon={mdiClose}
        aria-label="Close screens"
        shape="round"
        variant="ghost"
        color="secondary"
        size="small"
        class="shrink-0"
        onclick={onClose}
      />
    {/if}
  </div>
  <section class="flex flex-col gap-1">
    <Heading tag="h2" size="tiny" class="flex items-baseline gap-1.5 px-1 pt-1">
      Screens
      <span class="font-normal text-muted tabular-nums">{screens.length}</span>
    </Heading>
    {#if nodes.length === 0}
      <Text size="small" color="muted" class="px-1">No screens match</Text>
    {:else}
      <ul>
        {@render tree(nodes, 0)}
      </ul>
    {/if}
    {#if unchangedCount > 0}
      <Text size="tiny" color="muted" class="px-1 pt-2">
        {unchangedCount} unchanged {unchangedCount === 1 ? 'screen' : 'screens'} not shown
      </Text>
    {/if}
  </section>
</nav>
