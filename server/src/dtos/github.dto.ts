import z from 'zod';

export const PullRequestEventSchema = z.object({
  repository: z.object({ full_name: z.string().min(1) }),
  pull_request: z.object({
    number: z.int().positive(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
    merged: z.boolean().optional(),
  }),
});

export type GithubWebhookDto = { event?: string; signature?: string; payload: string };
