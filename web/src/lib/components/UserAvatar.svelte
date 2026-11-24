<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import { Icon } from '@immich/ui';
  import type { UserResponseDto } from '@futo-org/squint-sdk';
  import { mdiAccountCircle } from '@mdi/js';

  type Props = { user: UserResponseDto; size?: keyof typeof Constants.AvatarSizes };

  const { user, size = 'small' }: Props = $props();

  let failedUrl = $state<string>();
  const pictureUrl = $derived(user.avatarUrl === failedUrl ? undefined : user.avatarUrl);
</script>

<span class={['inline-flex shrink-0 overflow-hidden rounded-full', Constants.AvatarSizes[size]]}>
  {#if pictureUrl}
    <img
      src={pictureUrl}
      alt=""
      referrerpolicy="no-referrer"
      class="size-full object-cover"
      onerror={() => (failedUrl = pictureUrl)}
    />
  {:else}
    <Icon icon={mdiAccountCircle} size="100%" class="text-primary" aria-hidden />
  {/if}
</span>
