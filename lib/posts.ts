import type { HttpClient } from './http.js';
import type {
  Byline,
  ListPostsOptions,
  Post,
  PostCounts,
  PostDetail,
  PostListResult,
} from './types.js';

interface RawByline {
  id: number;
  name?: string;
  handle?: string;
  photo_url?: string;
}

interface RawPost {
  id: number;
  uuid?: string;
  title?: string;
  draft_title?: string;
  subtitle?: string | null;
  draft_subtitle?: string | null;
  slug?: string;
  type?: string;
  audience?: string;
  post_date?: string;
  is_published?: boolean;
  section_id?: number | null;
  section_name?: string | null;
  section_slug?: string | null;
  cover_image?: string | null;
  publishedBylines?: RawByline[];
  reaction_count?: number;
  comment_count?: number;
  canonical_url?: string;
  body_html?: string;
  wordcount?: number;
  description?: string | null;
}

interface PostManagementResponse {
  posts: RawPost[];
  offset: number;
  limit: number;
  total: number;
}

interface RawPostCounts {
  published: number;
  drafts: number;
  scheduled: number;
}

/**
 * List published posts (admin/dashboard endpoint).
 */
export async function listPublishedPosts(
  http: HttpClient,
  options?: ListPostsOptions,
): Promise<PostListResult> {
  const params: Record<string, string> = {
    offset: String(options?.offset ?? 0),
    limit: String(options?.limit ?? 25),
    order_by: options?.orderBy ?? 'post_date',
    order_direction: options?.orderDirection ?? 'desc',
  };

  if (options?.query) {
    params.query = options.query;
  }

  const response = await http.get<PostManagementResponse>('post_management/published', params);

  return {
    posts: response.posts.map(mapPost),
    total: response.total,
    offset: response.offset,
    limit: response.limit,
  };
}

/**
 * List scheduled posts (admin/dashboard endpoint).
 */
export async function listScheduledPosts(
  http: HttpClient,
  options?: ListPostsOptions,
): Promise<PostListResult> {
  const params: Record<string, string> = {
    offset: String(options?.offset ?? 0),
    limit: String(options?.limit ?? 25),
    order_by: options?.orderBy ?? 'trigger_at',
    order_direction: options?.orderDirection ?? 'asc',
  };

  const response = await http.get<PostManagementResponse>('post_management/scheduled', params);

  return {
    posts: response.posts.map(mapPost),
    total: response.total,
    offset: response.offset,
    limit: response.limit,
  };
}

/**
 * Get post counts (published, drafts, scheduled).
 *
 * Also useful as a session validation endpoint (returns 403 if not authorized).
 */
export async function getPostCounts(http: HttpClient): Promise<PostCounts> {
  const raw = await http.get<RawPostCounts>('post_management/counts');

  return {
    published: raw.published,
    drafts: raw.drafts,
    scheduled: raw.scheduled,
  };
}

/**
 * Get a single published post by slug.
 *
 * Note: Uses the post slug (not numeric ID). Only works for published posts.
 * Returns full HTML body and metadata.
 */
export async function getPost(http: HttpClient, slug: string): Promise<PostDetail> {
  const raw = await http.get<RawPost>(`posts/${slug}`);

  return {
    ...mapPost(raw),
    canonicalUrl: raw.canonical_url ?? '',
    bodyHtml: raw.body_html ?? '',
    wordcount: raw.wordcount ?? 0,
    description: raw.description ?? null,
  };
}

// --- Helpers ---

function mapPost(raw: RawPost): Post {
  return {
    id: raw.id,
    uuid: raw.uuid ?? '',
    title: raw.title ?? raw.draft_title ?? '',
    subtitle: raw.subtitle ?? raw.draft_subtitle ?? null,
    slug: raw.slug ?? '',
    type: raw.type ?? 'newsletter',
    audience: (raw.audience ?? 'everyone') as Post['audience'],
    postDate: raw.post_date ?? '',
    isPublished: raw.is_published ?? false,
    sectionId: raw.section_id ?? null,
    sectionName: raw.section_name ?? null,
    sectionSlug: raw.section_slug ?? null,
    coverImage: raw.cover_image ?? null,
    publishedBylines: mapBylines(raw.publishedBylines),
    reactionCount: raw.reaction_count ?? 0,
    commentCount: raw.comment_count ?? 0,
  };
}

function mapBylines(raw?: RawByline[]): Byline[] {
  if (!raw) return [];

  return raw.map((b) => ({
    id: b.id,
    name: b.name ?? '',
    handle: b.handle,
    photoUrl: b.photo_url,
  }));
}
