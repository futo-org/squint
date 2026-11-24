<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import type { TrendPoint } from '#lib/dashboard.js';
  import { formatDay, formatNumber } from '#lib/format.js';

  type Props = { points: TrendPoint[]; label: string };

  const { points, label }: Props = $props();

  const { Height, PaddingX, PaddingY, MarkerRadius, TooltipMargin } = Constants.Chart;

  let width = $state(0);
  let active = $state<number>();

  const values = $derived(points.map(({ value }) => value));
  const min = $derived(Math.min(...values));
  const max = $derived(Math.max(...values));
  const last = $derived(points.length - 1);

  const getX = (index: number) => (last === 0 ? width / 2 : PaddingX + (index / last) * (width - 2 * PaddingX));
  const getY = (value: number) =>
    max === min ? Height / 2 : Height - PaddingY - ((value - min) / (max - min)) * (Height - 2 * PaddingY);

  const path = $derived(
    points.map(({ value }, index) => `${index === 0 ? 'M' : 'L'}${getX(index)},${getY(value)}`).join(' '),
  );
  const marker = $derived(active ?? last);
  const current = $derived(active === undefined ? undefined : points[active]);
  const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

  const tooltipX = $derived(clamp(getX(marker), TooltipMargin, width - TooltipMargin));

  const select = (index: number) => {
    active = clamp(index, 0, last);
  };

  const handlePointerMove = (event: PointerEvent) => {
    const { left } = (event.currentTarget as Element).getBoundingClientRect();
    const ratio = (event.clientX - left - PaddingX) / (width - 2 * PaddingX);
    select(Math.round(ratio * last));
  };

  const handleKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft': {
        select(marker - 1);
        break;
      }
      case 'ArrowRight': {
        select(marker + 1);
        break;
      }
      case 'Escape': {
        active = undefined;
        break;
      }
    }
  };
</script>

<div class="relative min-w-0" bind:clientWidth={width}>
  <div
    role="slider"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={last}
    aria-valuenow={marker}
    aria-valuetext="{formatNumber(points[marker].value)} on {formatDay(points[marker].date)}"
    tabindex="0"
    class="touch-pan-y rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    onpointermove={handlePointerMove}
    onpointerleave={() => (active = undefined)}
    onblur={() => (active = undefined)}
    onkeydown={handleKeydown}
  >
    <svg {width} height={Height} class="block" aria-hidden="true">
      <line x1="0" x2={width} y1={Height - 0.5} y2={Height - 0.5} class="stroke-light-300" stroke-width="1" />
      {#if current}
        <line x1={getX(marker)} x2={getX(marker)} y1="0" y2={Height} class="stroke-gray-400" stroke-width="1" />
      {/if}
      <path
        d={path}
        fill="none"
        stroke="var(--chart-series)"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        cx={getX(marker)}
        cy={getY(points[marker].value)}
        r={MarkerRadius}
        fill="var(--chart-series)"
        class="stroke-light-100"
        stroke-width="2"
      />
    </svg>
  </div>
  {#if current}
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md border bg-light px-2 py-1 text-xs whitespace-nowrap shadow-sm"
      style:left="{tooltipX}px"
    >
      <span class="font-semibold tabular-nums">{formatNumber(current.value)}</span>
      <span class="text-muted">{formatDay(current.date)}</span>
    </div>
  {/if}
  <div class="mt-1 flex justify-between text-xs text-muted">
    <span>{formatDay(points[0].date)}</span>
    <span>{formatDay(points[last].date)}</span>
  </div>
</div>
