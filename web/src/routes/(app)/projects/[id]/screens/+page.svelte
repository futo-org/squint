<script lang="ts">
  import { goto } from '$app/navigation';
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import ProjectTabs from '#lib/components/ProjectTabs.svelte';
  import RelativeTime from '#lib/components/RelativeTime.svelte';
  import SearchBar from '#lib/components/SearchBar.svelte';
  import { Constants } from '#lib/constants.js';
  import { toSearch } from '#lib/filter.js';
  import { createPreloadedQuery } from '#lib/queries/client.js';
  import { getProjectQuery } from '#lib/queries/project.query.js';
  import { searchScreensQuery } from '#lib/queries/screen.query.js';
  import { Icon, Text } from '@immich/ui';
  import { mdiChevronRight } from '@mdi/js';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };

  const { data }: Props = $props();

  const { projectId, query } = $derived(data);
  const project = createPreloadedQuery(() => getProjectQuery(projectId));
  const screens = createPreloadedQuery(() => searchScreensQuery({ projectId, query }));
  const base = $derived(`/projects/${projectId}`);

  const handleSearch = (query?: string) =>
    goto(`${base}/screens${toSearch({ query })}`, { replace: true, reset: false });
</script>

<svelte:head>
  <title>Screens - {project.data.name} - Squint</title>
</svelte:head>

<BreadcrumbPage breadcrumbs={[{ title: 'Projects', href: '/' }, { title: project.data.name }]}>
  <Text size="small" color="muted" class="font-mono">{project.data.repository}</Text>
  <ProjectTabs {projectId} current="screens" />
  <SearchBar {query} placeholder="Screen name" onSearch={handleSearch} />
  {#if screens.data.length === 0}
    <Text color="muted">
      {query ? 'No screens match this search.' : 'No screenshots have been published on main yet.'}
    </Text>
  {:else}
    <ul aria-label="Screens" class={Constants.ListClass}>
      {#each screens.data as screen (screen.name)}
        <li>
          <a
            href="{base}/history{toSearch({ screen: screen.name })}"
            class="flex items-center gap-3 py-3 ps-4 pe-3 hover:bg-light-200"
          >
            <Text fontWeight="medium" class="min-w-0 flex-1 truncate font-mono">{screen.name}</Text>
            <span class="flex shrink-0 flex-col items-end gap-1">
              <Text size="tiny" class="tabular-nums">
                {screen.versionCount} version{screen.versionCount === 1 ? '' : 's'}
              </Text>
              <Text size="tiny" color="muted">changed <RelativeTime date={screen.updatedAt} /></Text>
            </span>
            <Icon icon={mdiChevronRight} size="20" class="shrink-0 text-muted" aria-hidden />
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</BreadcrumbPage>
