<script lang="ts">
  import BreadcrumbPage from '#lib/components/BreadcrumbPage.svelte';
  import StatTile from '#lib/components/StatTile.svelte';
  import TrendChart from '#lib/components/TrendChart.svelte';
  import { Constants } from '#lib/constants.js';
  import { getChange, getTrend } from '#lib/dashboard.js';
  import { formatDay, formatNumber, formatSigned } from '#lib/format.js';
  import { Heading, Text } from '@immich/ui';
  import type { PageData } from './$types.js';

  type Props = { data: PageData };

  const { data }: Props = $props();

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  const screenshotCount = $derived(sum(data.projects.map((project) => project.screenshotCount)));
  const openPullRequestCount = $derived(sum(data.projects.map((project) => project.openPullRequestCount)));

  const rows = $derived(
    data.projects.map((project) => {
      const history = data.dashboard.history.filter(({ projectId }) => projectId === project.id);
      const points = getTrend(history, new Date());

      return { project, points, change: getChange(points) };
    }),
  );
  const charted = $derived(rows.filter(({ points }) => points.length > 0));
</script>

<svelte:head>
  <title>Dashboard - Squint</title>
</svelte:head>

<BreadcrumbPage breadcrumbs={[{ title: 'Dashboard' }]}>
  <dl class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <StatTile label="Projects" value={data.projects.length} href="/" />
    <StatTile label="Need review" value={data.inboxCount} href="/inbox" />
    <StatTile label="Open pull requests" value={openPullRequestCount} />
    <StatTile label="Screenshots on main" value={screenshotCount} />
  </dl>

  <section aria-labelledby="dashboard-screenshots" class="flex flex-col gap-3">
    <div>
      <Heading id="dashboard-screenshots" size="tiny" tag="h2">Screenshots on main</Heading>
      <Text size="small" color="muted">Per project, over the last {Constants.DashboardDays} days.</Text>
    </div>
    {#if charted.length === 0}
      <Text color="muted">No screenshots have been published on main yet.</Text>
    {:else}
      <ul aria-label="Screenshots per project" class={Constants.ListClass}>
        {#each charted as { project, points, change } (project.id)}
          <li class="grid items-center gap-x-6 gap-y-8 p-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div class="flex min-w-0 flex-col gap-1">
              <a href="/projects/{project.id}" class="truncate font-mono font-medium hover:underline">{project.name}</a>
              <Text size="tiny" color="muted" class="truncate font-mono">{project.repository}</Text>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-semibold tabular-nums">{formatNumber(points.at(-1)?.value ?? 0)}</span>
                <Text size="tiny" color="muted">{formatSigned(change)} since {formatDay(points[0].date)}</Text>
              </div>
            </div>
            <TrendChart {points} label="Screenshots on main for {project.name}" />
          </li>
        {/each}
      </ul>
      <details class="text-sm">
        <summary class="cursor-pointer text-muted">Show as a table</summary>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full text-start tabular-nums">
            <thead class="text-muted">
              <tr class="border-b">
                <th scope="col" class="py-2 pe-4 text-start font-medium">Project</th>
                <th scope="col" class="py-2 pe-4 text-start font-medium">From</th>
                <th scope="col" class="py-2 pe-4 text-end font-medium">Then</th>
                <th scope="col" class="py-2 pe-4 text-end font-medium">Now</th>
                <th scope="col" class="py-2 text-end font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {#each charted as { project, points, change } (project.id)}
                <tr class="border-b">
                  <th scope="row" class="py-2 pe-4 text-start font-mono font-normal">{project.name}</th>
                  <td class="py-2 pe-4">{formatDay(points[0].date)}</td>
                  <td class="py-2 pe-4 text-end">{formatNumber(points[0].value)}</td>
                  <td class="py-2 pe-4 text-end">{formatNumber(points.at(-1)?.value ?? 0)}</td>
                  <td class="py-2 text-end">{formatSigned(change)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {/if}
  </section>
</BreadcrumbPage>
