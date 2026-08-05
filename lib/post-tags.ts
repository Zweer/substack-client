import type { HttpClient } from './http.js';
import type { CreatePostTagInput, PostTag } from './types.js';

interface RawPostTag {
  id: string;
  name: string;
  slug: string;
  hidden: boolean;
}

interface PostTagAssignment {
  id: string;
  publication_id: number;
  post_id: number;
  post_tag_id: string;
}

/**
 * List all post-tags for the publication.
 *
 * Post-tags are the UUID-based tagging system (distinct from numeric section IDs).
 * Posts can have multiple tags.
 */
export async function listPostTags(http: HttpClient): Promise<PostTag[]> {
  const raw = await http.get<RawPostTag[]>('publication/post-tag');

  return raw.map(mapPostTag);
}

/**
 * Create a new post-tag.
 *
 * The slug is auto-generated from the name.
 */
export async function createPostTag(http: HttpClient, input: CreatePostTagInput): Promise<PostTag> {
  const raw = await http.post<RawPostTag>('publication/post-tag', { name: input.name });

  return mapPostTag(raw);
}

/**
 * Delete a post-tag.
 */
export async function deletePostTag(http: HttpClient, id: string): Promise<void> {
  await http.delete(`publication/post-tag/${id}`);
}

/**
 * Assign a tag to a post.
 */
export async function assignTagToPost(
  http: HttpClient,
  postId: number,
  tagId: string,
): Promise<void> {
  await http.post<PostTagAssignment>(`post/${postId}/tag/${tagId}`);
}

/**
 * Remove a tag from a post.
 */
export async function removeTagFromPost(
  http: HttpClient,
  postId: number,
  tagId: string,
): Promise<void> {
  await http.delete(`post/${postId}/tag/${tagId}`);
}

/**
 * List tags assigned to a specific post.
 */
export async function listPostTagsForPost(http: HttpClient, postId: number): Promise<string[]> {
  const raw = await http.get<PostTagAssignment[]>(`post/${postId}/tag`);

  return raw.map((assignment) => assignment.post_tag_id);
}

function mapPostTag(raw: RawPostTag): PostTag {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    hidden: raw.hidden,
  };
}
