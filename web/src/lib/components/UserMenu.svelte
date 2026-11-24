<script lang="ts">
  import type { UserResponseDto } from '@futo-org/squint-sdk';
  import UserAvatar from '#lib/components/UserAvatar.svelte';
  import { Badge, Button, Icon } from '@immich/ui';
  import { mdiCog } from '@mdi/js';
  import { fade } from 'svelte/transition';

  type Props = { user: UserResponseDto };

  const { user }: Props = $props();

  let isOpen = $state(false);
  let container = $state<HTMLElement>();

  const handleWindowClick = (event: MouseEvent) => {
    if (isOpen && !container?.contains(event.target as Node)) {
      isOpen = false;
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      isOpen = false;
    }
  };
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div bind:this={container} class="relative flex">
  <button
    type="button"
    class="flex rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    aria-label="Account"
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    onclick={() => (isOpen = !isOpen)}
  >
    <UserAvatar {user} />
  </button>

  {#if isOpen}
    <div
      role="dialog"
      aria-label="Account"
      transition:fade={{ duration: 100 }}
      class="fixed inset-e-4 top-16 z-50 w-[min(360px,100vw-2rem)] rounded-3xl bg-gray-200 p-4 shadow-lg dark:border dark:border-white/10 dark:bg-neutral-900"
    >
      <div class="flex flex-col items-center gap-4 rounded-3xl bg-white p-4 dark:bg-primary/10">
        <UserAvatar {user} size="giant" />
        <div class="flex max-w-full min-w-0 flex-col items-center gap-1">
          <p class="max-w-full truncate text-center text-lg font-medium text-primary">{user.name}</p>
          <p class="max-w-full truncate text-sm text-muted">{user.email}</p>
          <Badge size="small">{user.role}</Badge>
        </div>
        <Button
          href="/settings"
          size="small"
          color="secondary"
          variant="ghost"
          shape="round"
          class="border"
          onclick={() => (isOpen = false)}
        >
          <span class="flex items-center gap-2 px-2">
            <Icon icon={mdiCog} size="18" aria-hidden />
            Account settings
          </span>
        </Button>
      </div>
    </div>
  {/if}
</div>
