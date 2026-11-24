<script lang="ts">
  import { Text } from '@immich/ui';

  type Props = { connected: boolean; version: string };

  const { connected, version }: Props = $props();
</script>

<section aria-label="App status" class="flex items-center justify-between gap-2 ps-5">
  <div class="flex items-center gap-2">
    <span class={['size-1.75 shrink-0 rounded-full', connected ? 'bg-success' : 'bg-danger']} aria-hidden="true"></span>
    <Text size="small" color={connected ? undefined : 'danger'}>{connected ? 'Connected' : 'Disconnected'}</Text>
  </div>
  <Text size="small" color="muted">v{version}</Text>
</section>
