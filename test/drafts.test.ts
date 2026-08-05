import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from '../lib/drafts.js';
import { HttpClient } from '../lib/http.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

const RAW_DRAFT = {
  id: 123,
  uuid: 'abc-123',
  draft_title: 'Test Post',
  title: 'Test Post',
  draft_subtitle: 'A subtitle',
  slug: 'test-post',
  audience: 'everyone',
  draft_section_id: 42,
  section_id: 42,
  draft_created_at: '2026-07-01T10:00:00Z',
  draft_updated_at: '2026-07-01T10:00:00Z',
  draft_body: '{"type":"doc","content":[]}',
  is_published: false,
  draft_bylines: [{ id: 999, is_guest: false }],
  publishedBylines: [{ id: 999, name: 'Nic Vane', handle: 'nicvane' }],
};

const DRAFT_LIST_RESPONSE = {
  posts: [RAW_DRAFT, { ...RAW_DRAFT, id: 456 }],
  offset: 0,
  limit: 25,
  total: 2,
};

describe('createDraft', () => {
  it('should send correct POST payload with draft_title, draft_bylines, and return mapped Draft', async () => {
    server.use(
      http.get(`${API}/post_management/drafts`, () =>
        HttpResponse.json({ posts: [RAW_DRAFT], offset: 0, limit: 1, total: 1 }),
      ),
      http.post(`${API}/drafts`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.draft_title).toBe('My Post');
        expect(body.draft_subtitle).toBe('A subtitle');
        expect(body.draft_section_id).toBe(7);
        expect(body.section_chosen).toBe(true);
        expect(body.type).toBe('newsletter');
        expect(body.draft_bylines).toEqual([{ id: 999, is_guest: false }]);
        return HttpResponse.json(RAW_DRAFT);
      }),
    );

    const http_ = createHttpClient();
    const draft = await createDraft(http_, {
      title: 'My Post',
      subtitle: 'A subtitle',
      sectionId: 7,
    });

    expect(draft.id).toBe(123);
    expect(draft.uuid).toBe('abc-123');
    expect(draft.title).toBe('Test Post');
    expect(draft.subtitle).toBe('A subtitle');
    expect(draft.sectionId).toBe(42);
    expect(draft.audience).toBe('everyone');
    expect(draft.isPublished).toBe(false);
    expect(draft.publishedBylines).toHaveLength(1);
  });

  it('should fallback to publication_user when no existing drafts', async () => {
    server.use(
      http.get(`${API}/post_management/drafts`, () =>
        HttpResponse.json({ posts: [], offset: 0, limit: 1, total: 0 }),
      ),
      http.get(`${API}/publication_user`, () =>
        HttpResponse.json({ pub_users: [{ user_id: 777 }] }),
      ),
      http.post(`${API}/drafts`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.draft_title).toBe('Minimal');
        expect(body.draft_bylines).toEqual([{ id: 777, is_guest: false }]);
        return HttpResponse.json(RAW_DRAFT);
      }),
    );

    const http_ = createHttpClient();
    await createDraft(http_, { title: 'Minimal' });
  });
});

describe('updateDraft', () => {
  it('should fetch current draft and include bylines in PUT payload', async () => {
    server.use(
      http.get(`${API}/drafts/123`, () => HttpResponse.json(RAW_DRAFT)),
      http.put(`${API}/drafts/123`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.draft_bylines).toEqual([{ id: 999, is_guest: false }]);
        expect(body.draft_body).toBe('{"type":"doc","content":[{"type":"paragraph"}]}');
        expect(body.draft_section_id).toBe(10);
        expect(body.section_chosen).toBe(true);
        return HttpResponse.json(RAW_DRAFT);
      }),
    );

    const http_ = createHttpClient();
    await updateDraft(http_, 123, {
      body: '{"type":"doc","content":[{"type":"paragraph"}]}',
      sectionId: 10,
    });
  });

  it('should preserve existing values when updating only body', async () => {
    server.use(
      http.get(`${API}/drafts/123`, () => HttpResponse.json(RAW_DRAFT)),
      http.put(`${API}/drafts/123`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.draft_title).toBe('Test Post');
        expect(body.draft_subtitle).toBe('A subtitle');
        expect(body.draft_section_id).toBe(42);
        return HttpResponse.json(RAW_DRAFT);
      }),
    );

    const http_ = createHttpClient();
    await updateDraft(http_, 123, { body: '{"type":"doc","content":[]}' });
  });
});

describe('getDraft', () => {
  it('should return full Draft with body', async () => {
    server.use(http.get(`${API}/drafts/123`, () => HttpResponse.json(RAW_DRAFT)));

    const http_ = createHttpClient();
    const draft = await getDraft(http_, 123);

    expect(draft.id).toBe(123);
    expect(draft.uuid).toBe('abc-123');
    expect(draft.title).toBe('Test Post');
    expect(draft.subtitle).toBe('A subtitle');
    expect(draft.slug).toBe('test-post');
    expect(draft.audience).toBe('everyone');
    expect(draft.sectionId).toBe(42);
    expect(draft.draftCreatedAt).toBe('2026-07-01T10:00:00Z');
    expect(draft.draftUpdatedAt).toBe('2026-07-01T10:00:00Z');
    expect(draft.body).toBe('{"type":"doc","content":[]}');
    expect(draft.isPublished).toBe(false);
  });
});

describe('listDrafts', () => {
  it('should return DraftListResult from post_management/drafts', async () => {
    server.use(
      http.get(`${API}/post_management/drafts`, () => HttpResponse.json(DRAFT_LIST_RESPONSE)),
    );

    const http_ = createHttpClient();
    const result = await listDrafts(http_);

    expect(result.drafts).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.drafts[0].id).toBe(123);
    expect(result.drafts[1].id).toBe(456);
  });

  it('should pass offset and limit as query params', async () => {
    server.use(
      http.get(`${API}/post_management/drafts`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('offset')).toBe('10');
        expect(url.searchParams.get('limit')).toBe('5');
        expect(url.searchParams.get('order_by')).toBe('draft_updated_at');
        expect(url.searchParams.get('order_direction')).toBe('desc');
        return HttpResponse.json({ posts: [], offset: 10, limit: 5, total: 0 });
      }),
    );

    const http_ = createHttpClient();
    await listDrafts(http_, { offset: 10, limit: 5 });
  });
});

describe('deleteDraft', () => {
  it('should send DELETE request', async () => {
    let called = false;

    server.use(
      http.delete(`${API}/drafts/123`, () => {
        called = true;
        return HttpResponse.json({});
      }),
    );

    const http_ = createHttpClient();
    await deleteDraft(http_, 123);

    expect(called).toBe(true);
  });
});
