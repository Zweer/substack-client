import type { HttpClient } from './http.js';
import type {
  Byline,
  CreateDraftInput,
  Draft,
  DraftListResult,
  ListDraftsOptions,
  UpdateDraftInput,
} from './types.js';

interface RawByline {
  id: number;
  is_guest: boolean;
}

interface RawBylineExpanded {
  id: number;
  name?: string;
  handle?: string;
  photo_url?: string;
  is_guest?: boolean;
}

interface RawDraft {
  id: number;
  uuid?: string;
  title?: string;
  draft_title?: string;
  draft_subtitle?: string | null;
  subtitle?: string | null;
  slug?: string;
  audience?: string;
  draft_section_id?: number | null;
  section_id?: number | null;
  draft_created_at?: string;
  draft_updated_at?: string;
  draft_body?: string;
  is_published?: boolean;
  draft_bylines?: RawByline[];
  draftBylines?: RawBylineExpanded[];
  publishedBylines?: RawBylineExpanded[];
}

/** Response shape from GET /api/v1/post_management/drafts */
interface DraftListResponse {
  posts: RawDraft[];
  offset: number;
  limit: number;
  total: number;
}

/** Response shape from GET /api/v1/drafts?limit=N (cursor-based) */
interface DraftCursorListResponse {
  posts: RawDraft[];
  hasMore: boolean;
  nextCursor: string | null;
}

const EMPTY_DOC = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', attrs: { textAlign: null } }],
});

/**
 * Create a new draft (Step 1 of Substack's two-step creation).
 *
 * POST creates the shell draft. Use `updateDraft()` to add body content.
 * Bylines are resolved automatically from existing drafts or user profile.
 */
export async function createDraft(http: HttpClient, input: CreateDraftInput): Promise<Draft> {
  const bylines = await resolveBylines(http);

  const payload: Record<string, unknown> = {
    draft_title: input.title,
    draft_subtitle: input.subtitle ?? '',
    draft_bylines: bylines,
    type: 'newsletter',
  };

  if (input.sectionId) {
    payload.draft_section_id = input.sectionId;
    payload.section_chosen = true;
  }

  const raw = await http.post<RawDraft>('drafts', payload);

  return mapDraft(raw);
}

/**
 * Update a draft (Step 2: add body, settings).
 *
 * Fetches the current draft first to preserve existing values and inject bylines.
 * Always includes `draft_bylines` as required by the API.
 */
export async function updateDraft(
  http: HttpClient,
  id: number,
  input: UpdateDraftInput,
): Promise<Draft> {
  const current = await http.get<RawDraft>(`drafts/${id}`);
  const bylines = extractBylines(current);

  const payload: Record<string, unknown> = {
    draft_title: input.title ?? current.draft_title ?? current.title,
    draft_subtitle: input.subtitle ?? current.draft_subtitle ?? current.subtitle ?? '',
    draft_body: input.body ?? current.draft_body ?? EMPTY_DOC,
    draft_bylines: bylines,
    detect_language: true,
  };

  // Section assignment
  if (input.sectionId !== undefined) {
    payload.draft_section_id = input.sectionId;
    payload.section_chosen = !!input.sectionId;
  } else {
    payload.draft_section_id = current.draft_section_id ?? current.section_id ?? null;
    payload.section_chosen = !!(current.draft_section_id ?? current.section_id);
  }

  if (input.audience !== undefined) {
    payload.audience = input.audience;
  }

  if (input.writeCommentPermissions !== undefined) {
    payload.write_comment_permissions = input.writeCommentPermissions;
  }

  if (input.shouldSendEmail !== undefined) {
    payload.should_send_email = input.shouldSendEmail;
  }

  if (input.coverImage !== undefined) {
    payload.cover_image = input.coverImage;
  }

  const raw = await http.put<RawDraft>(`drafts/${id}`, payload);

  return mapDraft(raw);
}

/**
 * Get a single draft by ID, including its full ProseMirror body.
 */
export async function getDraft(http: HttpClient, id: number): Promise<Draft> {
  const raw = await http.get<RawDraft>(`drafts/${id}`);

  return mapDraft(raw);
}

/**
 * List drafts (admin endpoint with offset-based pagination).
 */
export async function listDrafts(
  http: HttpClient,
  options?: ListDraftsOptions,
): Promise<DraftListResult> {
  const params: Record<string, string> = {
    offset: String(options?.offset ?? 0),
    limit: String(options?.limit ?? 25),
    order_by: 'draft_updated_at',
    order_direction: 'desc',
  };

  const response = await http.get<DraftListResponse>('post_management/drafts', params);

  return {
    drafts: response.posts.map(mapDraft),
    total: response.total,
    hasMore: response.offset + response.limit < response.total,
  };
}

/**
 * Delete a draft.
 */
export async function deleteDraft(http: HttpClient, id: number): Promise<void> {
  await http.delete(`drafts/${id}`);
}

// --- Helpers ---

async function resolveBylines(http: HttpClient): Promise<RawByline[]> {
  try {
    const response = await http.get<DraftListResponse>('post_management/drafts', {
      offset: '0',
      limit: '1',
      order_by: 'draft_updated_at',
      order_direction: 'desc',
    });

    if (response.posts.length > 0) {
      const post = response.posts[0];
      const bylines = extractBylines(post);
      if (bylines.length > 0) return bylines;
    }
  } catch {
    // Fall through to profile lookup
  }

  try {
    const profile = await http.get<{ pub_users: Array<{ user_id: number }> }>('publication_user');
    if (profile.pub_users.length > 0) {
      return [{ id: profile.pub_users[0].user_id, is_guest: false }];
    }
  } catch {
    // Cannot resolve
  }

  throw new Error(
    'Cannot resolve bylines: no existing drafts found and profile fetch failed. ' +
      'Ensure the session cookie is valid.',
  );
}

function extractBylines(raw: RawDraft): RawByline[] {
  if (raw.draft_bylines && raw.draft_bylines.length > 0) {
    return raw.draft_bylines;
  }

  if (raw.draftBylines && raw.draftBylines.length > 0) {
    return raw.draftBylines.map((b) => ({ id: b.id, is_guest: b.is_guest ?? false }));
  }

  if (raw.publishedBylines && raw.publishedBylines.length > 0) {
    return raw.publishedBylines.map((b) => ({ id: b.id, is_guest: false }));
  }

  return [];
}

function mapDraft(raw: RawDraft): Draft {
  return {
    id: raw.id,
    uuid: raw.uuid ?? '',
    title: raw.draft_title ?? raw.title ?? '',
    subtitle: raw.draft_subtitle ?? raw.subtitle ?? null,
    slug: raw.slug ?? '',
    audience: (raw.audience ?? 'everyone') as Draft['audience'],
    sectionId: raw.draft_section_id ?? raw.section_id ?? null,
    draftCreatedAt: raw.draft_created_at ?? '',
    draftUpdatedAt: raw.draft_updated_at ?? '',
    isPublished: raw.is_published ?? false,
    body: raw.draft_body,
    publishedBylines: mapBylines(raw.publishedBylines),
  };
}

function mapBylines(raw?: RawBylineExpanded[]): Byline[] {
  if (!raw) return [];

  return raw.map((b) => ({
    id: b.id,
    name: b.name ?? '',
    handle: b.handle,
    photoUrl: b.photo_url,
  }));
}
