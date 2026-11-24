<script lang="ts">
  import { formatNumber } from '#lib/format.js';

  type Props = { label: string; value: number; href?: string };

  const { label, value, href }: Props = $props();
</script>

<div class="relative flex flex-col gap-1 rounded-xl border bg-light-100 p-4 {href ? 'hover:bg-light-200' : ''}">
  <dt class="text-sm text-muted">
    {#if href}
      <a {href} class="after:absolute after:inset-0">{label}</a>
    {:else}
      {label}
    {/if}
  </dt>
  <dd class="text-2xl font-semibold tabular-nums">{formatNumber(value)}</dd>
</div>
