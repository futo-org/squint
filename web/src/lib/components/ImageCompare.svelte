<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import type { Snippet } from 'svelte';

  type Props = { before: string; after: string; alt: string; children?: Snippet };

  const { before, after, alt, children }: Props = $props();

  let position = $state(50);

  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  const handlePointer = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    if (event.pointerType !== 'mouse' && event.buttons === 0) {
      return;
    }

    const { left, width } = event.currentTarget.getBoundingClientRect();
    position = clamp(((event.clientX - left) / width) * 100);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const step = { ArrowLeft: -Constants.CompareKeyStep, ArrowRight: Constants.CompareKeyStep }[event.key];
    if (step === undefined) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    position = clamp(position + step);
  };
</script>

<div
  role="slider"
  aria-label="Compare before and after"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(position)}
  tabindex="0"
  class={[Constants.FrameClass, Constants.BorderClass, 'cursor-ew-resize touch-none select-none']}
  onpointermove={handlePointer}
  onpointerdown={handlePointer}
  onkeydown={handleKeydown}
>
  <img src={before} alt="{alt} before" class={Constants.ImageClass} draggable="false" />
  <img
    src={after}
    alt="{alt} after"
    class="absolute inset-0 block w-full"
    style:clip-path="inset(0 0 0 {position}%)"
    draggable="false"
  />
  {@render children?.()}
  <div class="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary" style:left="{position}%"></div>
</div>
