<script lang="ts">
  import { ControlBar, ControlBarDescription, ControlBarHeader, ControlBarOverflow, ControlBarTitle } from '@immich/ui';
  import { mdiArrowLeft } from '@mdi/js';
  import type { Snippet } from 'svelte';

  type Props = {
    title?: string;
    description?: string;
    class?: string;
    closeOnEsc?: boolean;
    onBack: () => void;
    titleSuffix?: Snippet;
    children?: Snippet;
  };

  const { title, description, class: className = '', closeOnEsc, onBack, titleSuffix, children }: Props = $props();
</script>

<ControlBar
  variant="ghost"
  shape="rectangle"
  class="flex-nowrap [&>div:first-child]:min-w-0 [&>div:first-child]:shrink {className}"
  static
  {closeOnEsc}
  closeIcon={mdiArrowLeft}
  translations={{ close: 'Back' }}
  onClose={onBack}
>
  {#if title || description}
    <ControlBarHeader>
      {#if title && titleSuffix}
        <span class="flex min-w-0 items-center gap-2">
          <ControlBarTitle tag="h1">{title}</ControlBarTitle>
          {@render titleSuffix()}
        </span>
      {:else if title}
        <ControlBarTitle tag="h1">{title}</ControlBarTitle>
      {/if}
      {#if description}
        <ControlBarDescription class="truncate">{description}</ControlBarDescription>
      {/if}
    </ControlBarHeader>
  {/if}
  {#if children}
    <ControlBarOverflow>
      {@render children()}
    </ControlBarOverflow>
  {/if}
</ControlBar>
