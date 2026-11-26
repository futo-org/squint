<script lang="ts">
  import { goto } from '$app/navigation';
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import FilterChips from '#lib/components/FilterChips.svelte';
  import SearchBar from '#lib/components/SearchBar.svelte';
  import { Constants } from '#lib/constants.js';
  import { type ProjectFilter, toSearch } from '#lib/filter.js';
  import ProjectFilterModal from '#lib/modals/ProjectFilterModal.svelte';
  import { createPreloadedQuery } from '#lib/queries/client.js';
  import { searchProjectsQuery } from '#lib/queries/project.query.js';
  import {
    Badge,
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    CardTitle,
    Icon,
    modalManager,
    Text,
  } from '@immich/ui';
  import { mdiChevronRight, mdiImageMultipleOutline, mdiSourceRepository } from '@mdi/js';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };
  type Project = (typeof projects.data)[number];

  const { data }: Props = $props();

  const formatNumber = new Intl.NumberFormat();

  const { filter } = $derived(data);
  const projects = createPreloadedQuery(() => searchProjectsQuery(filter));
  const allProjects = createPreloadedQuery(() => searchProjectsQuery());
  const repositories = $derived([...new Set(allProjects.data.map(({ repository }) => repository))]);
  const isFiltered = $derived(Object.keys(filter).length > 0);

  const applyFilter = (change: ProjectFilter) =>
    goto(`/${toSearch({ ...filter, ...change })}`, { replace: true, reset: false });

  const handleFilters = async () => {
    const result = await modalManager.show(ProjectFilterModal, { filter, repositories });
    if (result) {
      await applyFilter(result);
    }
  };

  const chips = $derived(
    filter.repository
      ? [
          {
            label: filter.repository,
            icon: mdiSourceRepository,
            onClear: () => applyFilter({ repository: undefined }),
          },
        ]
      : [],
  );
</script>

{#snippet pullRequests(project: Project)}
  {#if project.openPullRequestCount > 0}
    <Badge size="small" color="primary" class="shrink-0">
      {project.openPullRequestCount} open PR{project.openPullRequestCount === 1 ? '' : 's'}
    </Badge>
  {/if}
{/snippet}

{#snippet screenshots(project: Project)}
  <span
    class="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold tabular-nums"
    title="{project.screenshotCount} screenshots on main"
  >
    <Icon icon={mdiImageMultipleOutline} size="16" aria-hidden />
    {formatNumber.format(project.screenshotCount)}
  </span>
{/snippet}

<BreadcrumbPage breadcrumbs={[{ title: 'Projects' }]}>
  <SearchBar
    query={filter.query}
    placeholder="Name or repository"
    onSearch={(query) => applyFilter({ query })}
    onFilters={handleFilters}
  />
  <FilterChips {chips} />
  {#if projects.data.length === 0}
    <Text color="muted">
      {isFiltered ? 'No projects match these filters.' : 'No project has published screenshots yet.'}
    </Text>
  {:else}
    <ul aria-label="Projects" class={[Constants.ListClass, 'md:hidden']}>
      {#each projects.data as project (project.id)}
        <li>
          <a href="/projects/{project.id}" class="flex items-center gap-3 py-3 ps-4 pe-3 hover:bg-light-200">
            <span class="flex min-w-0 flex-1 flex-col gap-1">
              <Text fontWeight="medium" class="truncate font-mono">{project.name}</Text>
              <Text size="tiny" color="muted" class="truncate font-mono">{project.repository}</Text>
            </span>
            {@render pullRequests(project)}
            {@render screenshots(project)}
            <Icon icon={mdiChevronRight} size="20" class="shrink-0 text-muted" aria-hidden />
          </a>
        </li>
      {/each}
    </ul>
    <ul aria-label="Projects" class="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-3">
      {#each projects.data as project (project.id)}
        <li class="flex">
          <Card color="secondary">
            <CardHeader>
              <CardTitle class="truncate font-mono">{project.name}</CardTitle>
              <Text size="tiny" color="muted" class="truncate font-mono">{project.repository}</Text>
            </CardHeader>
            <CardBody class="flex grow items-center gap-3">
              {@render screenshots(project)}
              <Text size="small" color="muted">screenshots on main</Text>
              <span class="grow"></span>
              {@render pullRequests(project)}
            </CardBody>
            <CardFooter class="justify-end">
              <Button href="/projects/{project.id}" size="small" shape="round" trailingIcon={mdiChevronRight}>
                View
              </Button>
            </CardFooter>
          </Card>
        </li>
      {/each}
    </ul>
  {/if}
</BreadcrumbPage>
