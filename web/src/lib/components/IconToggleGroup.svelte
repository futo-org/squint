<script lang="ts" generics="Value extends string">
  import { Constants } from '#lib/constants.js';
  import { IconButton } from '@immich/ui';

  type Props = {
    label: string;
    items: Array<{ value: Value; label: string; icon: string }>;
    value: Value;
    onChange: (value: Value) => void;
  };

  const { label, items, value, onChange }: Props = $props();
</script>

<div role="group" aria-label={label} class={Constants.ToggleGroupClass}>
  {#each items as item (item.value)}
    <IconButton
      icon={item.icon}
      aria-label={item.label}
      title={item.label}
      aria-pressed={item.value === value}
      variant={item.value === value ? 'filled' : 'ghost'}
      color="secondary"
      shape="round"
      size="small"
      onclick={() => onChange(item.value)}
    />
  {/each}
</div>
