<script lang="ts">
  import { goto } from '$app/navigation';
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import BuildRow from '#lib/components/BuildRow.svelte';
  import FilterChips from '#lib/components/FilterChips.svelte';
  import SearchBar from '#lib/components/SearchBar.svelte';
  import { Constants } from '#lib/constants.js';
  import { type BuildFilter, toSearch } from '#lib/filter.js';
  import BuildFilterModal from '#lib/modals/BuildFilterModal.svelte';
  import { searchBranchesQuery, searchBuildsQuery } from '#lib/queries/build.query.js';
  import { createPreloadedQuery } from '#lib/queries/client.js';
  import { searchProjectsQuery } from '#lib/queries/project.query.js';
  import { ReviewStatus } from '@futo-org/squint-sdk';
  import { modalManager, Text } from '@immich/ui';
  import { mdiSourceBranch } from '@mdi/js';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };

  const { data }: Props = $props();

  const builds = createPreloadedQuery(() => searchBuildsQuery(data.filter));
  const branches = createPreloadedQuery(() => searchBranchesQuery({ review: ReviewStatus.NeedsReview }));
  const projects = createPreloadedQuery(() => searchProjectsQuery());
  const projectNames = $derived(Object.fromEntries(projects.data.map(({ id, name }) => [id, name])));

  const { query, branch } = $derived(data.filter);

  const applyFilter = (change: BuildFilter) =>
    goto(`/inbox${toSearch({ query, branch, ...change })}`, { replace: true, reset: false });

  const handleFilters = async () => {
    const filter = { query, branch };
    const result = await modalManager.show(BuildFilterModal, { filter, branches: branches.data, fields: ['branch'] });
    if (result) {
      await applyFilter(result);
    }
  };

  const chips = $derived(
    branch ? [{ label: branch, icon: mdiSourceBranch, onClear: () => applyFilter({ branch: undefined }) }] : [],
  );
</script>

<svelte:head>
  <title>Inbox - Squint</title>
</svelte:head>

<BreadcrumbPage breadcrumbs={[{ title: 'Inbox' }]}>
  <Text size="small" color="muted">Pull requests with changes waiting for an approval, across every project.</Text>
  <SearchBar
    {query}
    placeholder="Branch, commit or pull request"
    onSearch={(query) => applyFilter({ query })}
    onFilters={handleFilters}
  />
  <FilterChips {chips} />
  {#if builds.data.length === 0}
    <Text color="muted">{query || branch ? 'Nothing matches these filters.' : 'Nothing needs review.'}</Text>
  {:else}
    <ul aria-label="Needs review" class={Constants.ListClass}>
      {#each builds.data as build (build.id)}
        <li><BuildRow {build} project={projectNames[build.projectId]} /></li>
      {/each}
    </ul>
  {/if}
</BreadcrumbPage>
