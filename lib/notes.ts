import type { HttpClient } from './http.js';
import type { CreateNoteInput, Note } from './types.js';

interface RawNote {
  id: number;
  body: unknown;
}

interface NotesListResponse {
  items: RawNote[];
  nextCursor: string | null;
}

interface NoteDraftsResponse {
  drafts: RawNote[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Create a note (short-form post in the Substack Notes feed).
 *
 * Notes use the `comment/feed` endpoint — Substack internally treats them as "feed comments".
 * Unlike draft_body (stringified JSON), notes use a raw JSON object for bodyJson.
 *
 * ⚠️ This endpoint is protected by Cloudflare WAF more aggressively than other endpoints.
 * From headless browser contexts, it may return 403.
 */
export async function createNote(http: HttpClient, input: CreateNoteInput): Promise<Note> {
  const payload = {
    bodyJson: {
      type: 'doc',
      attrs: {
        schemaVersion: 'v1',
        title: null,
      },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: input.text }],
        },
      ],
    },
    replyMinimumRole: input.replyMinimumRole ?? 'everyone',
  };

  const raw = await http.post<RawNote>('comment/feed', payload);

  return mapNote(raw);
}

/**
 * List notes from the feed.
 */
export async function listNotes(http: HttpClient): Promise<Note[]> {
  const response = await http.get<NotesListResponse>('notes');

  return response.items.map(mapNote);
}

/**
 * List note drafts.
 */
export async function listNoteDrafts(http: HttpClient, limit = 25): Promise<Note[]> {
  const response = await http.get<NoteDraftsResponse>('feed/drafts', {
    limit: String(limit),
  });

  return response.drafts.map(mapNote);
}

/**
 * Delete a note.
 */
export async function deleteNote(http: HttpClient, id: number): Promise<void> {
  await http.delete(`comment/${id}`);
}

function mapNote(raw: RawNote): Note {
  return {
    id: raw.id,
    body: raw.body,
  };
}
