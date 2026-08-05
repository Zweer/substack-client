import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../lib/http.js';
import {
  assignTagToPost,
  createPostTag,
  deletePostTag,
  listPostTags,
  listPostTagsForPost,
  removeTagFromPost,
} from '../lib/post-tags.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

const RAW_TAG = {
  id: 'c197b803-ecc6-46c8-93ad-2a18c5ed3876',
  publication_id: 9425834,
  name: 'Ale',
  slug: 'ale',
  hidden: false,
};

describe('listPostTags', () => {
  it('should return array of PostTag objects', async () => {
    server.use(
      http.get(`${API}/publication/post-tag`, () =>
        HttpResponse.json([RAW_TAG, { ...RAW_TAG, id: 'other-uuid', name: 'Bea', slug: 'bea' }]),
      ),
    );

    const http_ = createHttpClient();
    const tags = await listPostTags(http_);

    expect(tags).toHaveLength(2);
    expect(tags[0].id).toBe('c197b803-ecc6-46c8-93ad-2a18c5ed3876');
    expect(tags[0].name).toBe('Ale');
    expect(tags[0].slug).toBe('ale');
    expect(tags[0].hidden).toBe(false);
  });
});

describe('createPostTag', () => {
  it('should send POST with name and return tag', async () => {
    server.use(
      http.post(`${API}/publication/post-tag`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe('New Tag');
        return HttpResponse.json({
          id: 'new-uuid',
          publication_id: 9425834,
          name: 'New Tag',
          slug: 'new-tag',
          hidden: false,
        });
      }),
    );

    const http_ = createHttpClient();
    const tag = await createPostTag(http_, { name: 'New Tag' });

    expect(tag.id).toBe('new-uuid');
    expect(tag.name).toBe('New Tag');
    expect(tag.slug).toBe('new-tag');
  });
});

describe('deletePostTag', () => {
  it('should send DELETE to /publication/post-tag/:id', async () => {
    let called = false;

    server.use(
      http.delete(`${API}/publication/post-tag/some-uuid`, () => {
        called = true;
        return HttpResponse.json({});
      }),
    );

    const http_ = createHttpClient();
    await deletePostTag(http_, 'some-uuid');
    expect(called).toBe(true);
  });
});

describe('assignTagToPost', () => {
  it('should POST to /post/:postId/tag/:tagId', async () => {
    let called = false;

    server.use(
      http.post(`${API}/post/100/tag/tag-uuid`, () => {
        called = true;
        return HttpResponse.json({
          id: 'assignment-uuid',
          publication_id: 9425834,
          post_id: 100,
          post_tag_id: 'tag-uuid',
        });
      }),
    );

    const http_ = createHttpClient();
    await assignTagToPost(http_, 100, 'tag-uuid');
    expect(called).toBe(true);
  });
});

describe('removeTagFromPost', () => {
  it('should DELETE /post/:postId/tag/:tagId', async () => {
    let called = false;

    server.use(
      http.delete(`${API}/post/100/tag/tag-uuid`, () => {
        called = true;
        return HttpResponse.json({});
      }),
    );

    const http_ = createHttpClient();
    await removeTagFromPost(http_, 100, 'tag-uuid');
    expect(called).toBe(true);
  });
});

describe('listPostTagsForPost', () => {
  it('should return array of tag IDs assigned to the post', async () => {
    server.use(
      http.get(`${API}/post/100/tag`, () =>
        HttpResponse.json([
          { id: 'assign-1', publication_id: 9425834, post_id: 100, post_tag_id: 'tag-a' },
          { id: 'assign-2', publication_id: 9425834, post_id: 100, post_tag_id: 'tag-b' },
        ]),
      ),
    );

    const http_ = createHttpClient();
    const tagIds = await listPostTagsForPost(http_, 100);

    expect(tagIds).toEqual(['tag-a', 'tag-b']);
  });
});
