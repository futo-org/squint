<script lang="ts">
  import RelativeTime from '#lib/components/RelativeTime.svelte';
  import { Constants } from '#lib/constants.js';
  import { Badge, Icon, IconButton, Text } from '@immich/ui';
  import { type BuildResponseDto, BuildStatus, ReviewStatus } from '@futo-org/squint-sdk';
  import { mdiCheckCircle, mdiImageMultipleOutline, mdiSourcePull } from '@mdi/js';

  type Props = { build: BuildResponseDto; project?: string };

  const { build, project }: Props = $props();

  const pullRequest = $derived(build.pullRequest);
  const needsAttention = $derived(build.review === ReviewStatus.NeedsReview);
  const isApproved = $derived(build.review === ReviewStatus.Approved);
  const details = $derived([
    ...(project ? [project] : []),
    build.branch,
    build.commit.slice(0, Constants.ShortCommitLength),
  ]);
</script>

<div class="relative flex items-center gap-3 py-3 ps-4 pe-3 hover:bg-light-200">
  {#if needsAttention}
    <span role="img" aria-label="Needs review" class="absolute inset-y-0 inset-s-0 w-1 bg-primary"></span>
  {/if}
  <span class="flex min-w-0 flex-1 flex-col gap-1">
    <a href="/builds/{build.id}" class="truncate after:absolute after:inset-0">
      <Text fontWeight={needsAttention ? 'bold' : 'medium'} class="truncate">
        {#if pullRequest}
          <span class="font-normal text-muted tabular-nums">#{pullRequest.number}</span>
          {pullRequest.title ?? build.branch}
        {:else}
          {build.release ?? build.branch}
        {/if}
      </Text>
    </a>
    <span class="flex min-w-0 items-center gap-2">
      {#if pullRequest}
        <Badge size="tiny" color={Constants.PullRequestStateColors[pullRequest.state]} class="shrink-0">
          {pullRequest.state}
        </Badge>
      {:else}
        <Badge size="tiny" color={build.release ? 'success' : 'secondary'} class="shrink-0">{build.kind}</Badge>
      {/if}
      {#if build.status === BuildStatus.Pending}
        <Badge size="tiny" color="warning" class="shrink-0">publishing</Badge>
      {/if}
      <Text size="tiny" color="muted" class="min-w-0 truncate font-mono">
        {details.join(' · ')}
      </Text>
    </span>
  </span>
  {#if pullRequest}
    <IconButton
      href={pullRequest.url}
      target="_blank"
      rel="noreferrer"
      icon={mdiSourcePull}
      aria-label="Pull request #{pullRequest.number}"
      variant="ghost"
      color="secondary"
      shape="round"
      size="small"
      class="relative shrink-0"
    />
  {/if}
  <span class="flex shrink-0 flex-col items-end gap-1">
    {#if build.reviewableCount > 0}
      <span
        class="flex items-center gap-1 font-mono text-xs font-semibold tabular-nums"
        title="{build.approvedCount} of {build.reviewableCount} screens approved"
      >
        {#if isApproved}
          <Icon icon={mdiCheckCircle} size="16" class="text-success" role="img" aria-label="Approved" />
        {/if}
        <Icon icon={mdiImageMultipleOutline} size="14" aria-hidden />
        {build.approvedCount}/{build.reviewableCount}
      </span>
    {:else}
      <Text size="tiny" color="muted">no changes</Text>
    {/if}
    {#if build.expiresAt}
      <Text size="tiny" color="muted" class="relative">deleted <RelativeTime date={build.expiresAt} /></Text>
    {:else}
      <Text size="tiny" color="muted" class="relative"><RelativeTime date={build.createdAt} /></Text>
    {/if}
  </span>
</div>
