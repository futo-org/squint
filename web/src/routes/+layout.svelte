<script lang="ts">
  import '#lib/app.css';
  import { live } from '#lib/live.svelte.js';
  import { TooltipProvider } from '@immich/ui';
  import { onMount, type Snippet } from 'svelte';

  type Props = {
    children?: Snippet;
  };

  let { children }: Props = $props();

  onMount(() => {
    live.connect();

    return () => live.disconnect();
  });
</script>

<TooltipProvider>
  {@render children?.()}
</TooltipProvider>
