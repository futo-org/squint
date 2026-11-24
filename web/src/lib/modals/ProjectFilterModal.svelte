<script lang="ts">
  import { Constants } from '#lib/constants.js';
  import type { ProjectFilter } from '#lib/filter.js';
  import { Field, FormModal, Select } from '@immich/ui';
  import { mdiTune } from '@mdi/js';
  import { untrack } from 'svelte';

  type Props = { filter: ProjectFilter; repositories: string[]; onClose: (filter?: ProjectFilter) => void };

  const { filter, repositories, onClose }: Props = $props();

  const any = Constants.AnyOption;
  const options = $derived([{ value: any, label: 'All repositories' }, ...repositories.map((value) => ({ value }))]);

  let repository = $state(untrack(() => filter.repository) ?? any);

  const handleSubmit = () => onClose({ ...filter, repository: repository === any ? undefined : repository });
</script>

<FormModal title="Filters" icon={mdiTune} submitText="Apply" onClose={() => onClose()} onSubmit={handleSubmit}>
  <Field label="Repository">
    <Select {options} bind:value={repository} />
  </Field>
</FormModal>
