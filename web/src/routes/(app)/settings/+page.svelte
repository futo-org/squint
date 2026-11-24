<script lang="ts">
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import UserAvatar from '#lib/components/UserAvatar.svelte';
  import { Badge, Heading, Text, ThemeSwitcher } from '@immich/ui';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };

  const { data }: Props = $props();
</script>

<svelte:head>
  <title>Settings - Squint</title>
</svelte:head>

<BreadcrumbPage breadcrumbs={[{ title: 'Settings' }]}>
  <section class="flex flex-col gap-3 rounded-xl border p-4">
    <Heading size="tiny" tag="h3">Account</Heading>
    <div class="flex items-center gap-4">
      <UserAvatar user={data.user} size="large" />
      <div class="flex min-w-0 flex-col gap-1">
        <span class="truncate font-medium text-black dark:text-white">{data.user.name}</span>
        <span class="truncate text-sm text-muted">{data.user.email}</span>
      </div>
      <span class="grow"></span>
      <Badge size="small">{data.user.role}</Badge>
    </div>
    <Text size="small" color="muted">
      Your name, email, picture and role come from FUTO SSO and update the next time you sign in.
    </Text>
  </section>

  <section class="flex items-center justify-between gap-3 rounded-xl border p-4">
    <div class="flex flex-col gap-1">
      <Heading size="tiny" tag="h3">Appearance</Heading>
      <Text size="small" color="muted">Switch between the light and dark theme.</Text>
    </div>
    <ThemeSwitcher />
  </section>
</BreadcrumbPage>
