import type { HttpClient } from './http.js';
import type { PublishInput, ScheduledReleaseInput, ScheduleInput } from './types.js';

/**
 * Publish a draft immediately.
 *
 * Calls prepublish check first (like the Substack UI does), then publishes.
 * The draft must have `draft_section_id` set if the publication has sections configured.
 */
export async function publish(http: HttpClient, id: number, input?: PublishInput): Promise<void> {
  await http.get(`drafts/${id}/prepublish`);

  const payload = {
    send: input?.send ?? true,
  };

  await http.post(`drafts/${id}/publish`, payload);
}

/**
 * Schedule a draft for future publication.
 *
 * Uses the dedicated `/scheduled_release` endpoint (NOT `/publish` with a date).
 * The draft must have `draft_section_id` set if the publication has sections configured.
 */
export async function schedule(http: HttpClient, id: number, input: ScheduleInput): Promise<void> {
  const payload = {
    trigger_at: input.date,
    post_audience: input.audience ?? 'everyone',
  };

  await http.post(`drafts/${id}/scheduled_release`, payload);
}

/**
 * Cancel a scheduled publication.
 *
 * Returns the IDs of the cancelled schedule(s).
 */
export async function unschedule(http: HttpClient, id: number): Promise<number[]> {
  return http.delete<number[]>(`drafts/${id}/scheduled_release`);
}

/**
 * Add a scheduled release tier to a draft (early access / multi-tier scheduling).
 *
 * Call multiple times to set up multi-tier early access:
 * - Founding members get it first
 * - Then paid subscribers
 * - Then everyone
 *
 * @example
 * ```typescript
 * await scheduledRelease(http, id, { date: '2026-07-13T18:00:00.000Z', postAudience: 'founding', emailAudience: 'founding' })
 * await scheduledRelease(http, id, { date: '2026-07-20T18:00:00.000Z', postAudience: 'everyone', emailAudience: 'only_free' })
 * ```
 */
export async function scheduledRelease(
  http: HttpClient,
  id: number,
  input: ScheduledReleaseInput,
): Promise<void> {
  const payload = {
    trigger_at: input.date,
    post_audience: input.postAudience,
    email_audience: input.emailAudience,
  };

  await http.post(`drafts/${id}/scheduled_release`, payload);
}

/**
 * Unpublish a published post, returning it to draft state.
 */
export async function unpublish(http: HttpClient, id: number): Promise<void> {
  await http.post(`drafts/${id}/unpublish`);
}
