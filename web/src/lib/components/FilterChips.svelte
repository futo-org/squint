<script lang="ts">
  import { Button } from '@immich/ui';
  import { mdiClose } from '@mdi/js';

  type Chip = { label: string; icon?: string; onClear: () => void };
  type Props = { chips: Chip[] };

  const { chips }: Props = $props();
</script>

{#if chips.length > 0}
  <ul aria-label="Active filters" class="flex flex-wrap items-center gap-2">
    {#each chips as { label, icon, onClear } (label)}
      <li>
        <Button
          size="tiny"
          shape="round"
          variant="outline"
          leadingIcon={icon}
          trailingIcon={mdiClose}
          aria-label="Clear {label}"
          onclick={onClear}
        >
          {label}
        </Button>
      </li>
    {/each}
  </ul>
{/if}
