/**
 * Client configuration options.
 */
export interface SubstackClientOptions {
  /** Publication URL: "yourname.substack.com" or "https://yourname.substack.com" */
  publication: string;
  /** substack.sid session cookie value */
  sid: string;
  /** connect.sid session cookie value (optional, may be needed for some operations) */
  connectSid?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Max retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Minimum delay between requests in ms to avoid rate limiting (default: 500) */
  minRequestInterval?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// --- Common ---

export type Audience = 'everyone' | 'only_paid' | 'founding';

export type EmailAudience = Audience | 'only_free';

export interface Byline {
  id: number;
  name: string;
  handle?: string;
  photoUrl?: string;
}

// --- Drafts ---

export interface CreateDraftInput {
  title: string;
  subtitle?: string;
  sectionId?: number;
}

export interface UpdateDraftInput {
  /** ProseMirror document JSON (stringified) */
  body?: string;
  title?: string;
  subtitle?: string;
  sectionId?: number;
  audience?: Audience;
  writeCommentPermissions?: Audience;
  shouldSendEmail?: boolean;
  coverImage?: string | null;
}

export interface Draft {
  id: number;
  uuid: string;
  title: string;
  subtitle: string | null;
  slug: string;
  audience: Audience;
  sectionId: number | null;
  draftCreatedAt: string;
  draftUpdatedAt: string;
  isPublished: boolean;
  /** Full draft body (ProseMirror JSON string) — only on getDraft, not listDrafts */
  body?: string;
  publishedBylines: Byline[];
}

export interface ListDraftsOptions {
  offset?: number;
  limit?: number;
}

export interface DraftListResult {
  drafts: Draft[];
  total: number;
  hasMore: boolean;
}

// --- Publish ---

export interface PublishInput {
  /** Send as email to subscribers (default: true) */
  send?: boolean;
}

export interface ScheduleInput {
  /** ISO 8601 datetime for scheduled publication (UTC) */
  date: string;
  /** Override audience at schedule time */
  audience?: Audience;
}

export interface ScheduledReleaseInput {
  /** ISO 8601 datetime when this release tier becomes active */
  date: string;
  /** Who can see the post at this release stage */
  postAudience: Audience;
  /** Who gets the email notification at this release stage */
  emailAudience: EmailAudience;
}

// --- Images ---

export interface ImageUploadResult {
  /** Numeric image ID */
  id: number;
  /** CDN URL of the uploaded image */
  url: string;
  /** MIME content type */
  contentType: string;
  /** File size in bytes */
  bytes: number;
  /** Image width in pixels */
  imageWidth: number;
  /** Image height in pixels */
  imageHeight: number;
}

// --- Sections ---

export interface Section {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isLive: boolean;
  isDefaultOn: boolean;
  siblingRank: number;
}

export interface CreateSectionInput {
  name: string;
  description?: string;
}

export interface UpdateSectionInput {
  name?: string;
  description?: string;
}

// --- Posts (Read) ---

export interface Post {
  id: number;
  uuid: string;
  title: string;
  subtitle: string | null;
  slug: string;
  type: string;
  audience: Audience;
  postDate: string;
  isPublished: boolean;
  sectionId: number | null;
  sectionName: string | null;
  sectionSlug: string | null;
  coverImage: string | null;
  publishedBylines: Byline[];
  reactionCount: number;
  commentCount: number;
}

export interface PostDetail extends Post {
  canonicalUrl: string;
  bodyHtml: string;
  wordcount: number;
  description: string | null;
}

export interface ListPostsOptions {
  offset?: number;
  limit?: number;
  orderBy?: 'post_date' | 'trigger_at';
  orderDirection?: 'asc' | 'desc';
  query?: string;
}

export interface PostListResult {
  posts: Post[];
  total: number;
  offset: number;
  limit: number;
}

export interface PostCounts {
  published: number;
  drafts: number;
  scheduled: number;
}

// --- Notes ---

export interface CreateNoteInput {
  /** Note text content (plain text — will be wrapped in ProseMirror paragraph) */
  text: string;
  /** Who can reply: 'everyone' | 'only_paid' (default: 'everyone') */
  replyMinimumRole?: 'everyone' | 'only_paid';
}

export interface Note {
  id: number;
  body: unknown;
}

// --- Post-Tags ---

export interface PostTag {
  id: string;
  name: string;
  slug: string;
  hidden: boolean;
}

export interface CreatePostTagInput {
  name: string;
}
