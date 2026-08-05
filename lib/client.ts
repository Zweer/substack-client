import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from './drafts.js';
import { HttpClient } from './http.js';
import { uploadImage } from './images.js';
import { createNote, deleteNote, listNoteDrafts, listNotes } from './notes.js';
import {
  assignTagToPost,
  createPostTag,
  deletePostTag,
  listPostTags,
  listPostTagsForPost,
  removeTagFromPost,
} from './post-tags.js';
import { getPost, getPostCounts, listPublishedPosts, listScheduledPosts } from './posts.js';
import { publish, schedule, scheduledRelease, unpublish, unschedule } from './publish.js';
import { createSection, deleteSection, listSections, updateSection } from './sections.js';
import type {
  CreateDraftInput,
  CreateNoteInput,
  CreatePostTagInput,
  CreateSectionInput,
  Draft,
  DraftListResult,
  ImageUploadResult,
  ListDraftsOptions,
  ListPostsOptions,
  Note,
  Post,
  PostCounts,
  PostDetail,
  PostListResult,
  PostTag,
  PublishInput,
  ScheduledReleaseInput,
  ScheduleInput,
  Section,
  SubstackClientOptions,
  UpdateDraftInput,
  UpdateSectionInput,
} from './types.js';

/**
 * Main client for interacting with Substack's internal API.
 *
 * @example
 * ```typescript
 * const client = new SubstackClient({
 *   publication: 'yourname.substack.com',
 *   sid: process.env.SUBSTACK_SID,
 * });
 *
 * const draft = await client.createDraft({ title: 'Hello' });
 * await client.updateDraft(draft.id, { body: proseMirrorJson });
 * await client.publish(draft.id);
 * ```
 */
export class SubstackClient {
  private readonly http: HttpClient;

  constructor(options: SubstackClientOptions) {
    this.http = new HttpClient(options);
  }

  // --- Drafts ---

  /** Create a new draft (shell). Use updateDraft() to add body content. */
  async createDraft(input: CreateDraftInput): Promise<Draft> {
    return createDraft(this.http, input);
  }

  /** Update a draft (add body, change settings). Always injects bylines automatically. */
  async updateDraft(id: number, input: UpdateDraftInput): Promise<Draft> {
    return updateDraft(this.http, id, input);
  }

  /** Get a single draft by ID, including full ProseMirror body. */
  async getDraft(id: number): Promise<Draft> {
    return getDraft(this.http, id);
  }

  /** List drafts with offset-based pagination. */
  async listDrafts(options?: ListDraftsOptions): Promise<DraftListResult> {
    return listDrafts(this.http, options);
  }

  /** Delete a draft. */
  async deleteDraft(id: number): Promise<void> {
    return deleteDraft(this.http, id);
  }

  // --- Publish ---

  /** Publish a draft immediately. */
  async publish(id: number, input?: PublishInput): Promise<void> {
    return publish(this.http, id, input);
  }

  /** Schedule a draft for future publication via /scheduled_release. */
  async schedule(id: number, input: ScheduleInput): Promise<void> {
    return schedule(this.http, id, input);
  }

  /** Cancel a scheduled publication. Returns cancelled schedule IDs. */
  async unschedule(id: number): Promise<number[]> {
    return unschedule(this.http, id);
  }

  /** Unpublish a published post, returning it to draft state. */
  async unpublish(id: number): Promise<void> {
    return unpublish(this.http, id);
  }

  /**
   * Add a scheduled release tier (early access / multi-tier scheduling).
   * Call multiple times to set up multi-tier release.
   */
  async scheduledRelease(id: number, input: ScheduledReleaseInput): Promise<void> {
    return scheduledRelease(this.http, id, input);
  }

  // --- Images ---

  /**
   * Upload an image to Substack's CDN.
   * Accepts a file path or Buffer. Returns full image metadata.
   */
  async uploadImage(input: string | Buffer, mimeType?: string): Promise<ImageUploadResult> {
    return uploadImage(this.http, input, mimeType);
  }

  // --- Sections ---

  /** List all sections for the publication. */
  async listSections(): Promise<Section[]> {
    return listSections(this.http);
  }

  /** Create a new section. Slug is auto-generated from name. */
  async createSection(input: CreateSectionInput): Promise<Section> {
    return createSection(this.http, input);
  }

  /** Update a section (PATCH). Slug does NOT change when name is updated. */
  async updateSection(id: number, input: UpdateSectionInput): Promise<Section> {
    return updateSection(this.http, id, input);
  }

  /** Delete a section. Posts within it become unassigned. */
  async deleteSection(id: number): Promise<void> {
    return deleteSection(this.http, id);
  }

  // --- Posts (Read) ---

  /** List published posts with offset-based pagination. */
  async listPublishedPosts(options?: ListPostsOptions): Promise<PostListResult> {
    return listPublishedPosts(this.http, options);
  }

  /** List scheduled posts. */
  async listScheduledPosts(options?: ListPostsOptions): Promise<PostListResult> {
    return listScheduledPosts(this.http, options);
  }

  /** Get post counts (published, drafts, scheduled). Also serves as session validation. */
  async getPostCounts(): Promise<PostCounts> {
    return getPostCounts(this.http);
  }

  /** Get a single published post by slug. Returns full HTML body. */
  async getPost(slug: string): Promise<PostDetail> {
    return getPost(this.http, slug);
  }

  // --- Notes ---

  /** Create a note (short-form post in the Notes feed). */
  async createNote(input: CreateNoteInput): Promise<Note> {
    return createNote(this.http, input);
  }

  /** List notes from the feed. */
  async listNotes(): Promise<Note[]> {
    return listNotes(this.http);
  }

  /** List note drafts. */
  async listNoteDrafts(limit?: number): Promise<Note[]> {
    return listNoteDrafts(this.http, limit);
  }

  /** Delete a note. */
  async deleteNote(id: number): Promise<void> {
    return deleteNote(this.http, id);
  }

  // --- Post-Tags ---

  /** List all post-tags for the publication. */
  async listPostTags(): Promise<PostTag[]> {
    return listPostTags(this.http);
  }

  /** Create a new post-tag. Slug is auto-generated from name. */
  async createPostTag(input: CreatePostTagInput): Promise<PostTag> {
    return createPostTag(this.http, input);
  }

  /** Delete a post-tag. */
  async deletePostTag(id: string): Promise<void> {
    return deletePostTag(this.http, id);
  }

  /** Assign a tag to a post. */
  async assignTagToPost(postId: number, tagId: string): Promise<void> {
    return assignTagToPost(this.http, postId, tagId);
  }

  /** Remove a tag from a post. */
  async removeTagFromPost(postId: number, tagId: string): Promise<void> {
    return removeTagFromPost(this.http, postId, tagId);
  }

  /** List tag IDs assigned to a specific post. */
  async listPostTagsForPost(postId: number): Promise<string[]> {
    return listPostTagsForPost(this.http, postId);
  }
}
