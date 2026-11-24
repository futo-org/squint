<script lang="ts">
  import { Button } from '@immich/ui';
  import { mdiImageMultipleOutline, mdiSourceBranch } from '@mdi/js';

  type Props = { projectId: string; current: 'builds' | 'screens' };

  const { projectId, current }: Props = $props();

  const tabs = $derived([
    { value: 'builds', title: 'Builds', icon: mdiSourceBranch, href: `/projects/${projectId}` },
    { value: 'screens', title: 'Screens', icon: mdiImageMultipleOutline, href: `/projects/${projectId}/screens` },
  ]);
</script>

<nav aria-label="Project" class="flex gap-2">
  {#each tabs as { value, title, icon, href } (value)}
    <Button
      {href}
      size="small"
      shape="round"
      leadingIcon={icon}
      color={value === current ? 'primary' : 'secondary'}
      variant={value === current ? 'filled' : 'ghost'}
      aria-current={value === current ? 'page' : undefined}
    >
      {title}
    </Button>
  {/each}
</nav>
