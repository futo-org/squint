<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import type { Screenshot } from '#lib/screens.js';

  type Props = { mask: string; regions: NonNullable<Screenshot['diffRegions']>; visible: boolean };

  const { mask, regions, visible }: Props = $props();

  let width = $state(0);
  let height = $state(0);

  const padding = Constants.Diff.RegionPadding;
</script>

<div
  aria-hidden="true"
  class={['pointer-events-none absolute inset-0 transition-opacity', visible ? 'opacity-100' : 'opacity-0']}
>
  <img src={mask} alt="" class="invisible absolute size-full" bind:naturalWidth={width} bind:naturalHeight={height} />
  <div class="absolute inset-0 bg-black/50"></div>
  <div
    class="absolute inset-0 bg-fuchsia-500"
    style:mask-image="url({mask})"
    style:mask-size="100% 100%"
    style:mask-repeat="no-repeat"
  ></div>
  {#if width > 0 && height > 0}
    <svg viewBox="0 0 {width} {height}" preserveAspectRatio="none" class="absolute inset-0 size-full">
      {#each regions as region (`${region.x}:${region.y}`)}
        <rect
          x={region.x - padding}
          y={region.y - padding}
          width={region.width + padding * 2}
          height={region.height + padding * 2}
          rx={padding}
          vector-effect="non-scaling-stroke"
          class="fill-none stroke-fuchsia-500 stroke-2"
        />
      {/each}
    </svg>
  {/if}
</div>
