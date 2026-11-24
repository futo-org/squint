<script lang="ts">
  import { page } from '$app/state';
  import { Button, Heading, Stack, Text } from '@immich/ui';
  import { mdiHomeOutline, mdiRefresh } from '@mdi/js';

  const isNotFound = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{isNotFound ? 'Not found' : 'Error'} - Squint</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
  <Stack gap={2}>
    <Text size="small" color="muted">Error {page.status}</Text>
    <Heading tag="h1" size="large">{isNotFound ? 'Page not found' : 'Something went wrong'}</Heading>
    <Text class="font-mono wrap-break-word">
      {isNotFound ? 'This page does not exist.' : (page.error?.message ?? 'Unknown error')}
    </Text>
  </Stack>
  <div class="flex gap-2">
    <Button href="/" shape="round" color="secondary" leadingIcon={mdiHomeOutline}>Home</Button>
    <Button shape="round" color="secondary" leadingIcon={mdiRefresh} onclick={() => location.reload()}>Reload</Button>
  </div>
</main>
