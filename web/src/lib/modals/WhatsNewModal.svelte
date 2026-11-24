<script lang="ts">
  import RelativeTime from '#lib/components/RelativeTime.svelte';
  import { Constants } from '#lib/constants.js';
  import { Badge, BasicModal, Heading, Text } from '@immich/ui';
  import type { ReleaseResponseDto } from '@futo-org/squint-sdk';
  import { mdiPartyPopper } from '@mdi/js';

  type Props = { releases: ReleaseResponseDto[]; onClose: () => void };

  const { releases, onClose }: Props = $props();
</script>

<BasicModal title="What's new" icon={mdiPartyPopper} size="medium" {onClose}>
  {#if releases.length === 0}
    <Text color="muted">No release notes yet.</Text>
  {:else}
    <div class="flex flex-col gap-6">
      {#each releases as release (release.version)}
        <section class="flex flex-col gap-2" aria-label="Version {release.version}">
          <div class="flex items-baseline justify-between gap-2">
            <Heading tag="h3" size="tiny">v{release.version}</Heading>
            <Text size="tiny" color="muted"><RelativeTime date={release.date} /></Text>
          </div>
          <ul class="flex flex-col gap-1.5 text-sm">
            {#each release.notes as note (note.text)}
              <li class="flex items-start gap-2">
                <Badge size="tiny" color={Constants.ReleaseNoteColors[note.kind]} class="mt-0.5 shrink-0">
                  {note.kind}
                </Badge>
                <span>{note.text}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</BasicModal>
