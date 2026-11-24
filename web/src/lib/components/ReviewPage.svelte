<script lang="ts">
  import BackBar from '#lib/components/BackBar.svelte';
  import { Constants } from '#lib/constants.js';
  import {
    AppShell,
    AppShellHeader,
    AppShellSidebar,
    Button,
    IconButton,
    ProgressBar,
    Text,
    shortcuts,
  } from '@immich/ui';
  import { mdiArrowLeft, mdiArrowRight, mdiChevronLeft, mdiChevronRight, mdiFileTreeOutline } from '@mdi/js';
  import type { Snippet } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';

  type Props = {
    description: string;
    items: Array<{ done: boolean }>;
    index: number;
    canApprove: boolean;
    isMarking: boolean;
    nextLabel: string;
    onPage: (index: number) => void;
    onBack: () => void;
    onNext: () => void;
    onToggle: () => void;
    header: Snippet;
    titleSuffix?: Snippet;
    toolbar?: Snippet;
    sidebar: Snippet<[{ onClose?: () => void }]>;
    children: Snippet;
  };

  const {
    description,
    items,
    index,
    canApprove,
    isMarking,
    nextLabel,
    onPage,
    onBack,
    onNext,
    onToggle,
    header,
    titleSuffix,
    toolbar,
    sidebar,
    children,
  }: Props = $props();

  const count = $derived(items.length);
  const reviewed = $derived(items.filter(({ done }) => done).length);
  const isFirst = $derived(index === 0);
  const isLast = $derived(index >= count - 1);
  const showProgress = $derived(count >= Constants.Review.ProgressMinItems);

  const page = (offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= count) {
      return;
    }

    onPage(target);
  };

  const keyShortcuts = $derived([
    ...Constants.Review.NextKeys.map((key) => ({ shortcut: { key }, onShortcut: () => page(1) })),
    ...Constants.Review.PreviousKeys.map((key) => ({ shortcut: { key }, onShortcut: () => page(-1) })),
    { shortcut: { key: Constants.Review.ApproveKey }, onShortcut: () => canApprove && onToggle() },
  ]);

  const isWide = new MediaQuery(Constants.WideScreenQuery);
  let sidebarOpen = $state(isWide.current);

  $effect(() => {
    void index;
    if (!isWide.current) {
      sidebarOpen = false;
    }
  });
</script>

<svelte:window {@attach shortcuts(keyShortcuts)} />

<main>
  <AppShell>
    <AppShellHeader>
      <BackBar title="Review" {description} {titleSuffix} closeOnEsc={false} {onBack} />
    </AppShellHeader>

    {#if sidebarOpen && !isWide.current}
      <button
        type="button"
        aria-label="Close screens beside"
        tabindex="-1"
        class="absolute inset-0 z-20 cursor-default bg-black/40"
        onclick={() => (sidebarOpen = false)}
      ></button>
    {/if}
    <AppShellSidebar open={sidebarOpen}>
      {#if sidebarOpen}
        {@render sidebar({ onClose: isWide.current ? undefined : () => (sidebarOpen = false) })}
      {/if}
    </AppShellSidebar>

    <div class={['flex min-h-full flex-col', Constants.SurfaceClass]}>
      <div class={['sticky top-0 z-10 border-b', Constants.SurfaceClass]}>
        {#if showProgress}
          <ProgressBar
            aria-label="Reviewed screens"
            progress={reviewed}
            max={count}
            valueLabel="{reviewed} of {count} screens reviewed"
            size="tiny"
            shape="rectangle"
            stop={false}
            class="h-1"
          />
        {/if}
        <div class="flex items-center justify-between gap-2 px-4 py-2">
          <IconButton
            icon={mdiFileTreeOutline}
            aria-label={sidebarOpen ? 'Hide screens' : 'Show screens'}
            aria-expanded={sidebarOpen}
            class="-ms-2 shrink-0"
            shape="round"
            variant="ghost"
            color="secondary"
            size="small"
            onclick={() => (sidebarOpen = !sidebarOpen)}
          />
          <div class="min-w-0 grow">
            {@render header()}
          </div>
          <div class="flex h-8 shrink-0 items-center justify-end gap-1">
            <Text size="small" color="muted" class="whitespace-nowrap tabular-nums">
              {index + 1} of {count}
            </Text>
            <IconButton
              icon={mdiChevronLeft}
              class="[&_svg]:size-[120%]"
              aria-label="Previous screen"
              shape="round"
              variant="ghost"
              color="secondary"
              size="small"
              disabled={isFirst}
              onclick={() => page(-1)}
            />
            <IconButton
              icon={mdiChevronRight}
              class="[&_svg]:size-[120%]"
              aria-label="Next screen"
              shape="round"
              variant="ghost"
              color="secondary"
              size="small"
              disabled={isLast}
              onclick={() => page(1)}
            />
          </div>
        </div>
        {#if toolbar}
          <div class="flex flex-wrap items-center justify-end gap-2 px-4 pb-2">
            {@render toolbar()}
          </div>
        {/if}
      </div>
      <div class="flex grow flex-col">
        {@render children()}
      </div>
      <nav
        aria-label="Review steps"
        class="pointer-events-none sticky bottom-4 z-30 mt-4 flex shrink-0 items-center justify-between px-4"
      >
        <Button
          size="medium"
          shape="round"
          color="secondary"
          leadingIcon={mdiArrowLeft}
          class="pointer-events-auto shadow-lg"
          disabled={isFirst}
          onclick={() => page(-1)}
        >
          Previous
        </Button>
        <Button
          size="medium"
          shape="round"
          trailingIcon={mdiArrowRight}
          class="pointer-events-auto shadow-lg"
          loading={isMarking}
          onclick={onNext}
        >
          {nextLabel}
        </Button>
      </nav>
    </div>
  </AppShell>
</main>
