<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import { IconButton, Input } from '@immich/ui';
  import { mdiMagnify, mdiTune } from '@mdi/js';
  import { onDestroy } from 'svelte';

  type Props = {
    query?: string;
    placeholder: string;
    onSearch: (query?: string) => void;
    onFilters?: () => void;
  };

  const { query, placeholder, onSearch, onFilters }: Props = $props();

  let value = $derived(query ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;

  const handleInput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onSearch(value.trim() || undefined), Constants.SearchDebounceMs);
  };

  onDestroy(() => clearTimeout(timer));
</script>

<Input
  size="small"
  type="search"
  aria-label="Search"
  {placeholder}
  leadingIcon={mdiMagnify}
  bind:value
  oninput={handleInput}
>
  {#snippet trailingIcon()}
    {#if onFilters}
      <IconButton
        icon={mdiTune}
        aria-label="Filters"
        variant="ghost"
        color="secondary"
        shape="round"
        size="tiny"
        onclick={onFilters}
      />
    {/if}
  {/snippet}
</Input>
