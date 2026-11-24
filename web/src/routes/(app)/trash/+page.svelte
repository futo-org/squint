<script lang="ts">
  import { goto } from '$app/navigation';
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import BuildRow from '#lib/components/BuildRow.svelte';
  import FilterChips from '#lib/components/FilterChips.svelte';
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
    goto(`/trash${toSearch({ ...filter, ...change })}`, { replace: true, reset: false });

  const handleFilters = async () => {
    const fields = Constants.TrashFilterFields;
    const result = await modalManager.show(BuildFilterModal, { filter, branches: data.branches, fields });
    if (result) {
      await applyFilter(result);
    }
  };

  const chips = $derived([
    ...(filter.kind
      ? [{ label: Constants.KindLabels[filter.kind], onClear: () => applyFilter({ kind: undefined }) }]
      : []),
    ...(filter.pullRequestState
      ? [
          {
            label: `${Constants.PullRequestStateLabels[filter.pullRequestState]} pull request`,
            onClear: () => applyFilter({ pullRequestState: undefined }),
          },
        ]
      : []),
    ...(filter.branch
      ? [{ label: filter.branch, icon: mdiSourceBranch, onClear: () => applyFilter({ branch: undefined }) }]
      : []),
  ]);
</script>

<svelte:head>
  <title>Trash - Squint</title>
</svelte:head>

<BreadcrumbPage breadcrumbs={[{ title: 'Trash' }]}>
  <Text size="small" color="muted">
    Builds a newer build replaced, and builds of merged or closed pull requests. Their screenshots are deleted
    {Constants.TrashRetentionDays} days after they land here.
  </Text>
  <SearchBar
    query={filter.query}
    placeholder="Branch, commit or pull request"
    onSearch={(query) => applyFilter({ query })}
    onFilters={handleFilters}
  />
  <FilterChips {chips} />
  {#if data.builds.length === 0}
    <Text color="muted">{isFiltered ? 'Nothing in the trash matches these filters.' : 'The trash is empty.'}</Text>
  {:else}
    <ul aria-label="Trash" class={Constants.ListClass}>
      {#each data.builds as build (build.id)}
        <li><BuildRow {build} project={data.projectNames[build.projectId]} /></li>
      {/each}
    </ul>
  {/if}
</BreadcrumbPage>
