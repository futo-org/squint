<script lang="ts">
  import { Breadcrumbs, Container, type BreadcrumbItem } from '@immich/ui';
  import type { Snippet } from 'svelte';

  type Props = { breadcrumbs: BreadcrumbItem[]; children: Snippet };

  const { breadcrumbs, children }: Props = $props();
</script>

<div class="flex h-14 w-full items-center border-b px-4 py-2 sm:px-8">
  <Breadcrumbs items={breadcrumbs} />
</div>
<Container center size="large" class="flex flex-col gap-4 p-4 sm:p-8">
  {@render children()}
</Container>
