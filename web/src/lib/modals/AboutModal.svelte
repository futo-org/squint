<script lang="ts">
  import RelativeTime from '#lib/components/RelativeTime.svelte';
  import { Constants } from '#lib/constants.js';
  import { BasicModal, Heading, Icon, Link, Stack, Text } from '@immich/ui';
  import type { ServerAboutResponseDto } from '@futo-org/squint-sdk';
  import { mdiGithub, mdiInformationOutline } from '@mdi/js';

  type Props = { about: ServerAboutResponseDto; onClose: () => void };

  const { about, onClose }: Props = $props();
</script>

<BasicModal title="About" icon={mdiInformationOutline} size="small" {onClose}>
  <Stack gap={4}>
    <Stack gap={2}>
      <Heading size="tiny">Squint</Heading>
      <Text size="small" color="muted">
        Squint reviews how Immich looks before a change merges. Each pull request publishes screenshots of every screen,
        Squint compares them with the latest build of main and highlights what changed, and an approver signs off on
        each changed screen.
      </Text>
    </Stack>
    <div class="flex flex-col gap-4 sm:flex-row">
      <section aria-labelledby="about-resources" class="flex flex-1 flex-col gap-2">
        <Heading id="about-resources" size="tiny">Resources</Heading>
        <div class="flex items-center gap-2">
          <Icon icon={mdiGithub} size="1.5em" aria-hidden />
          <Link href={about.repositoryUrl} target="_blank" rel="noreferrer" class="text-sm text-primary">Source</Link>
        </div>
      </section>
      <section aria-labelledby="about-build" class="flex flex-1 flex-col gap-2">
        <Heading id="about-build" size="tiny">Build</Heading>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Version</dt>
          <dd>v{about.version}</dd>
          <dt class="text-muted">Commit</dt>
          <dd class="font-mono">
            {#if about.commit && about.commitUrl}
              <Link href={about.commitUrl} target="_blank" rel="noreferrer">
                {about.commit.slice(0, Constants.ShortCommitLength)}
              </Link>
            {:else}
              development
            {/if}
          </dd>
          {#if about.buildDate}
            <dt class="text-muted">Built</dt>
            <dd><RelativeTime date={about.buildDate} /></dd>
          {/if}
        </dl>
      </section>
    </div>
  </Stack>
</BasicModal>
