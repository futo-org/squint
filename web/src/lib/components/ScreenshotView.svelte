<script lang="ts">
  import { getBlobPath } from '@futo-org/squint-sdk';
  import DiffOverlay from '#lib/components/DiffOverlay.svelte';
  import ImageCompare from '#lib/components/ImageCompare.svelte';
  import { Constants } from '#lib/constants.js';
  import type { Screenshot } from '#lib/screens.js';

  type View = Pick<Screenshot, 'name' | 'status' | 'sha256' | 'baselineSha256' | 'diffSha256' | 'diffRegions'>;
  type Props = { screenshot: View; mode: 'single' | 'side-by-side' | 'slider'; showDiff: boolean };

  const { screenshot, mode, showDiff }: Props = $props();

  const images = $derived(
    [
      { label: 'before', sha256: screenshot.baselineSha256 },
      { label: 'after', sha256: screenshot.sha256 },
    ].filter((image): image is { label: string; sha256: string } => !!image.sha256),
  );
  const shown = $derived(mode === 'single' ? images.slice(-1) : images);
</script>

{#snippet diff()}
  {#if screenshot.diffSha256}
    <DiffOverlay mask={getBlobPath(screenshot.diffSha256)} regions={screenshot.diffRegions ?? []} visible={showDiff} />
  {/if}
{/snippet}

{#if mode === 'slider' && screenshot.baselineSha256 && screenshot.sha256}
  <ImageCompare
    before={getBlobPath(screenshot.baselineSha256)}
    after={getBlobPath(screenshot.sha256)}
    alt={screenshot.name}
  >
    {@render diff()}
  </ImageCompare>
{:else}
  <div class="grid gap-3 {shown.length > 1 ? 'md:grid-cols-2' : ''}">
    {#each shown as { label, sha256 } (label)}
      <figure class="min-w-0">
        <figcaption class="mb-1 text-xs tracking-wide text-muted uppercase">
          {shown.length > 1 ? label : screenshot.status}
        </figcaption>
        <div class={[Constants.FrameClass, Constants.BorderClass]}>
          <img src={getBlobPath(sha256)} alt="{screenshot.name} {label}" class={Constants.ImageClass} />
          {@render diff()}
        </div>
      </figure>
    {/each}
  </div>
{/if}
