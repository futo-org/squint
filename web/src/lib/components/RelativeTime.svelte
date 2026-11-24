<script lang="ts">
  import { formatDateTime, timeAgo } from '#lib/format.js';
  import { Tooltip } from '@immich/ui';

  type Props = { date: string };

  const { date }: Props = $props();
</script>

<Tooltip text={formatDateTime(date)}>
  {#snippet child({ props })}
    <time {...props} datetime={date}>{timeAgo(date)}</time>
  {/snippet}
</Tooltip>
