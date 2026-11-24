<script lang="ts">
  import { goto } from '$app/navigation';
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import BuildRow from '#lib/components/BuildRow.svelte';
  import FilterChips from '#lib/components/FilterChips.svelte';
  import ProjectTabs from '#lib/components/ProjectTabs.svelte';
  import SearchBar from '#lib/components/SearchBar.svelte';
  import { Constants } from '#lib/constants.js';
  import { type BuildFilter, toSearch } from '#lib/filter.js';
  import BuildFilterModal from '#lib/modals/BuildFilterModal.svelte';
  import { modalManager, Text } from '@immich/ui';
  import { mdiSourceBranch } from '@mdi/js';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };

  const { data }: Props = $props();

  const { filter } = $derived(data);
  const isFiltered = $derived(Object.keys(filter).length > 0);

  const applyFilter = (change: BuildFilter) =>
    goto(`/projects/${data.project.id}${toSearch({ ...filter, ...change })}`, { replace: true, reset: false });

  const handleFilters = async () => {
    const result = await modalManager.show(BuildFilterModal, { filter, branches: data.branches });
    if (result) {
      await applyFilter(result);
    }
  };

  const chips = $derived([
    ...(filter.review
      ? [{ label: Constants.ReviewLabels[filter.review], onClear: () => applyFilter({ review: undefined }) }]
      : []),
    ...(filter.kind
      ? [{ label: Constants.KindLabels[filter.kind], onClear: () => applyFilter({ kind: undefined }) }]
      : []),
    ...(filter.branch
      ? [{ label: filter.branch, icon: mdiSourceBranch, onClear: () => applyFilter({ branch: undefined }) }]
      : []),
  ]);
</script>

<svelte:head>
  <title>{data.project.name} - Squint</title>
</svelte:head>

<BreadcrumbPage breadcrumbs={[{ title: 'Projects', href: '/' }, { title: data.project.name }]}>
  <Text size="small" color="muted" class="font-mono">{data.project.repository}</Text>
  <ProjectTabs projectId={data.project.id} current="builds" />
  <SearchBar
    query={filter.query}
    placeholder="Branch, commit or pull request"
    onSearch={(query) => applyFilter({ query })}
    onFilters={handleFilters}
  />
  <FilterChips {chips} />
  {#if data.builds.length === 0}
    <Text color="muted">{isFiltered ? 'No builds match these filters.' : 'No builds yet.'}</Text>
  {:else}
    <ul aria-label="Builds" class={Constants.ListClass}>
      {#each data.builds as build (build.id)}
        <li><BuildRow {build} /></li>
      {/each}
    </ul>
  {/if}
</BreadcrumbPage>
