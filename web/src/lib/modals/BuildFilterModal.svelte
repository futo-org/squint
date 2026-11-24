<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import type { BuildFilter } from '#lib/filter.js';
  import { Field, FormModal, Select, Stack } from '@immich/ui';
  import { BuildKind, PullRequestState, ReviewStatus } from '@futo-org/squint-sdk';
  import { mdiTune } from '@mdi/js';
  import { untrack } from 'svelte';

  type Props = {
    filter: BuildFilter;
    branches: string[];
    fields?: Array<keyof BuildFilter>;
    onClose: (filter?: BuildFilter) => void;
  };

  const { filter, branches, fields = Constants.BuildFilterFields, onClose }: Props = $props();

  const any = Constants.AnyOption;
  const toOptions = <T extends string>(label: string, labels: Record<T, string>) => [
    { value: any, label },
    ...Object.entries<string>(labels).map(([value, label]) => ({ value, label })),
  ];

  const reviewOptions = toOptions('Any status', Constants.ReviewLabels);
  const kindOptions = toOptions('Any kind', Constants.KindLabels);
  const pullRequestOptions = toOptions('Any pull request', Constants.PullRequestStateLabels);
  const branchOptions = $derived([
    { value: any, label: 'All branches' },
    ...branches.map((branch) => ({ value: branch })),
  ]);

  const initial = untrack(() => filter);
  let review = $state<string>(initial.review ?? any);
  let kind = $state<string>(initial.kind ?? any);
  let pullRequestState = $state<string>(initial.pullRequestState ?? any);
  let branch = $state(initial.branch ?? any);

  const pick = <T extends string>(value: string) => (value === any ? undefined : (value as T));

  const handleSubmit = () =>
    onClose({
      ...filter,
      review: pick<ReviewStatus>(review),
      kind: pick<BuildKind>(kind),
      pullRequestState: pick<PullRequestState>(pullRequestState),
      branch: pick(branch),
    });
</script>

<FormModal title="Filters" icon={mdiTune} submitText="Apply" onClose={() => onClose()} onSubmit={handleSubmit}>
  <Stack gap={4}>
    {#if fields.includes('review')}
      <Field label="Status">
        <Select options={reviewOptions} bind:value={review} />
      </Field>
    {/if}
    {#if fields.includes('kind')}
      <Field label="Kind">
        <Select options={kindOptions} bind:value={kind} />
      </Field>
    {/if}
    {#if fields.includes('pullRequestState')}
      <Field label="Pull request">
        <Select options={pullRequestOptions} bind:value={pullRequestState} />
      </Field>
    {/if}
    {#if fields.includes('branch')}
      <Field label="Branch">
        <Select options={branchOptions} bind:value={branch} />
      </Field>
    {/if}
  </Stack>
</FormModal>
