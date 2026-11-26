<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import AppStatus from '#lib/components/AppStatus.svelte';
  import UserMenu from '#lib/components/UserMenu.svelte';
  import { Constants } from '#lib/constants.js';
  import { live } from '#lib/live.svelte.js';
  import AboutModal from '#lib/modals/AboutModal.svelte';
  import { getInboxCountQuery } from '#lib/queries/build.query.js';
  import { createPreloadedQuery } from '#lib/queries/client.js';
  import { getServerAboutQuery } from '#lib/queries/server-info.query.js';
  import { getMyUserQuery } from '#lib/queries/user.query.js';
  import { handleShowUnseenReleases, handleShowWhatsNew } from '#lib/release.js';
  import {
    AppShell,
    AppShellHeader,
    AppShellSidebar,
    Badge,
    FutoLogo,
    Icon,
    IconButton,
    modalManager,
    NavbarItem,
    ThemeSwitcher,
  } from '@immich/ui';
  import { mdiInformationOutline, mdiMenu, mdiPartyPopper } from '@mdi/js';
  import { onMount, type Snippet } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';

  type Props = {
    children?: Snippet;
  };

  let { children }: Props = $props();

  const user = createPreloadedQuery(getMyUserQuery);
  const about = createPreloadedQuery(getServerAboutQuery);
  const inboxCount = createPreloadedQuery(getInboxCountQuery);

  const isWide = new MediaQuery(Constants.WideScreenQuery);
  let isMenuOpen = $state(false);
  const isSidebarOpen = $derived(isWide.current || isMenuOpen);

  afterNavigate(() => {
    isMenuOpen = false;
  });

  onMount(() => {
    void handleShowUnseenReleases(about.data.version);
  });

  const isCurrent = (paths: string[]) => () =>
    paths.some((path) => page.url.pathname === path || page.url.pathname.startsWith(`${path}/`));

  const handleShowAbout = () => {
    isMenuOpen = false;
    void modalManager.show(AboutModal, { about: about.data });
  };

  const handleShowReleases = () => {
    isMenuOpen = false;
    void handleShowWhatsNew();
  };
</script>

{#snippet sidebarButton(title: string, icon: string, onclick: () => void)}
  <button
    type="button"
    class="flex w-full items-center gap-4 rounded-e-full py-3 ps-5 hover:bg-subtle hover:text-primary"
    {onclick}
  >
    <Icon {icon} size="1.375em" class="shrink-0" aria-hidden />
    <span class="text-sm font-medium">{title}</span>
  </button>
{/snippet}

<AppShell>
  <AppShellHeader class="justify-between px-4">
    <div class="flex items-center gap-2">
      {#if !isWide.current}
        <IconButton
          icon={mdiMenu}
          aria-label="Menu"
          aria-expanded={isMenuOpen}
          variant="ghost"
          color="secondary"
          shape="round"
          onclick={() => (isMenuOpen = !isMenuOpen)}
        />
      {/if}
      <a href="/" class="flex items-center gap-2" aria-label="Squint">
        <FutoLogo size="small" class="max-md:h-8" />
        <span class="text-xl font-semibold">Squint</span>
      </a>
    </div>
    <div class="flex items-center gap-2">
      <ThemeSwitcher />
      <UserMenu user={user.data} />
    </div>
  </AppShellHeader>
  <AppShellSidebar open={isSidebarOpen} border={!isWide.current} class={isSidebarOpen ? '' : 'invisible'}>
    <nav aria-label="Main" class="flex min-h-full flex-col justify-between gap-6 py-4 pe-4">
      <div>
        {#each Constants.Sections as { href, title, icon, paths } (href)}
          <div class="relative">
            <NavbarItem {href} {title} {icon} isActive={isCurrent(paths)} />
            {#if href === Constants.InboxPath && inboxCount.data > 0}
              <Badge
                size="small"
                color="primary"
                shape="round"
                class="pointer-events-none absolute inset-e-4 top-1/2 -translate-y-1/2"
              >
                {inboxCount.data}
              </Badge>
            {/if}
          </div>
        {/each}
      </div>
      <div class="flex flex-col gap-3">
        <div>
          {@render sidebarButton("What's new", mdiPartyPopper, handleShowReleases)}
          {@render sidebarButton('About', mdiInformationOutline, handleShowAbout)}
        </div>
        <AppStatus connected={live.connected} version={about.data.version} />
      </div>
    </nav>
  </AppShellSidebar>
  {@render children?.()}
</AppShell>
