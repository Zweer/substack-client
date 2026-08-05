import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../lib/http.js';
import { getPost, getPostCounts, listPublishedPosts, listScheduledPosts } from '../lib/posts.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

const RAW_POST = {
  id: 209908892,
  uuid: '1cc47b8a-9e77-457f-9be9-e7bf8d186e99',
  title: 'Test Post',
  subtitle: 'A subtitle',
  slug: 'test-post',
  type: 'newsletter',
  audience: 'only_paid',
  post_date: '2026-08-05T10:46:48.619Z',
  is_published: true,
  section_id: 403948,
  section_name: 'Ale',
  section_slug: 'ale',
  cover_image: null,
  publishedBylines: [{ id: 114676504, name: 'Nic Vane', handle: 'nicvane' }],
  reaction_count: 5,
  comment_count: 2,
};

describe('listPublishedPosts', () => {
  it('should return PostListResult with pagination', async () => {
    server.use(
      http.get(`${API}/post_management/published`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('offset')).toBe('0');
        expect(url.searchParams.get('limit')).toBe('25');
        expect(url.searchParams.get('order_by')).toBe('post_date');
        expect(url.searchParams.get('order_direction')).toBe('desc');
        return HttpResponse.json({
          posts: [RAW_POST],
          offset: 0,
          limit: 25,
          total: 1,
        });
      }),
    );

    const http_ = createHttpClient();
    const result = await listPublishedPosts(http_);

    expect(result.posts).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.posts[0].id).toBe(209908892);
    expect(result.posts[0].title).toBe('Test Post');
    expect(result.posts[0].sectionName).toBe('Ale');
    expect(result.posts[0].publishedBylines[0].name).toBe('Nic Vane');
    expect(result.posts[0].reactionCount).toBe(5);
  });

  it('should pass query parameter for search', async () => {
    server.use(
      http.get(`${API}/post_management/published`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('query')).toBe('chapter');
        return HttpResponse.json({ posts: [], offset: 0, limit: 25, total: 0 });
      }),
    );

    const http_ = createHttpClient();
    await listPublishedPosts(http_, { query: 'chapter' });
  });
});

describe('listScheduledPosts', () => {
  it('should use trigger_at as default order_by', async () => {
    server.use(
      http.get(`${API}/post_management/scheduled`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('order_by')).toBe('trigger_at');
        expect(url.searchParams.get('order_direction')).toBe('asc');
        return HttpResponse.json({ posts: [], offset: 0, limit: 25, total: 0 });
      }),
    );

    const http_ = createHttpClient();
    await listScheduledPosts(http_);
  });
});

describe('getPostCounts', () => {
  it('should return structured counts', async () => {
    server.use(
      http.get(`${API}/post_management/counts`, () =>
        HttpResponse.json({
          published: 10,
          publishedIsCapped: false,
          drafts: 3,
          draftsIsCapped: false,
          scheduled: 1,
          scheduledIsCapped: false,
        }),
      ),
    );

    const http_ = createHttpClient();
    const counts = await getPostCounts(http_);

    expect(counts.published).toBe(10);
    expect(counts.drafts).toBe(3);
    expect(counts.scheduled).toBe(1);
  });
});

describe('getPost', () => {
  it('should fetch a published post by slug with full details', async () => {
    server.use(
      http.get(`${API}/posts/test-post`, () =>
        HttpResponse.json({
          ...RAW_POST,
          canonical_url: 'https://test.substack.com/p/test-post',
          body_html: '<p>Hello</p>',
          wordcount: 42,
          description: 'A subtitle',
        }),
      ),
    );

    const http_ = createHttpClient();
    const post = await getPost(http_, 'test-post');

    expect(post.id).toBe(209908892);
    expect(post.canonicalUrl).toBe('https://test.substack.com/p/test-post');
    expect(post.bodyHtml).toBe('<p>Hello</p>');
    expect(post.wordcount).toBe(42);
    expect(post.description).toBe('A subtitle');
  });
});
