import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { SubstackClient } from '../lib/client.js';
import { SubstackAuthError, SubstackNotFoundError } from '../lib/errors.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(): SubstackClient {
  return new SubstackClient({
    publication: BASE_URL,
    sid: 'test-sid',
    maxRetries: 1,
    minRequestInterval: 0,
  });
}

const RAW_DRAFT = {
  id: 100,
  uuid: 'test-uuid',
  draft_title: 'Integration Test',
  title: 'Integration Test',
  draft_subtitle: null,
  slug: 'integration-test',
  audience: 'everyone',
  draft_section_id: null,
  section_id: null,
  draft_created_at: '2026-07-03T10:00:00Z',
  draft_updated_at: '2026-07-03T10:00:00Z',
  draft_body: '{"type":"doc","content":[]}',
  is_published: false,
  draft_bylines: [{ id: 1, is_guest: false }],
  publishedBylines: [{ id: 1, name: 'Test' }],
};

const DRAFT_LIST_RESPONSE = {
  posts: [RAW_DRAFT],
  offset: 0,
  limit: 25,
  total: 1,
};

describe('Integration: create → update → publish', () => {
  it('should create a draft, update with body, and publish', async () => {
    const calls: string[] = [];

    server.use(
      http.get(`${API}/post_management/drafts`, () => {
        calls.push('resolve-bylines');
        return HttpResponse.json(DRAFT_LIST_RESPONSE);
      }),
      http.post(`${API}/drafts`, () => {
        calls.push('create');
        return HttpResponse.json(RAW_DRAFT);
      }),
      http.get(`${API}/drafts/100`, () => {
        calls.push('get');
        return HttpResponse.json(RAW_DRAFT);
      }),
      http.put(`${API}/drafts/100`, () => {
        calls.push('update');
        return HttpResponse.json({
          ...RAW_DRAFT,
          draft_body: '{"type":"doc","content":[{"type":"paragraph"}]}',
        });
      }),
      http.get(`${API}/drafts/100/prepublish`, () => {
        calls.push('prepublish');
        return HttpResponse.json({ ok: true });
      }),
      http.post(`${API}/drafts/100/publish`, () => {
        calls.push('publish');
        return HttpResponse.json({ id: 100, is_published: true });
      }),
    );

    const client = createClient();
    const draft = await client.createDraft({ title: 'My Post' });
    expect(draft.id).toBe(100);

    const updated = await client.updateDraft(draft.id, {
      body: '{"type":"doc","content":[{"type":"paragraph"}]}',
    });
    expect(updated.body).toBe('{"type":"doc","content":[{"type":"paragraph"}]}');

    await client.publish(draft.id);
    expect(calls).toEqual(['resolve-bylines', 'create', 'get', 'update', 'prepublish', 'publish']);
  });
});

describe('Integration: create → schedule', () => {
  it('should create a draft and schedule for future via /scheduled_release', async () => {
    server.use(
      http.get(`${API}/post_management/drafts`, () => HttpResponse.json(DRAFT_LIST_RESPONSE)),
      http.post(`${API}/drafts`, () => HttpResponse.json(RAW_DRAFT)),
      http.get(`${API}/drafts/100`, () => HttpResponse.json(RAW_DRAFT)),
      http.put(`${API}/drafts/100`, () => HttpResponse.json(RAW_DRAFT)),
      http.post(`${API}/drafts/100/scheduled_release`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.trigger_at).toBe('2026-09-01T09:00:00Z');
        expect(body.post_audience).toBe('only_paid');
        return HttpResponse.json({ id: 100 });
      }),
    );

    const client = createClient();
    const draft = await client.createDraft({ title: 'Scheduled' });
    await client.updateDraft(draft.id, { body: '{"type":"doc","content":[]}' });
    await client.schedule(draft.id, { date: '2026-09-01T09:00:00Z', audience: 'only_paid' });
  });
});

describe('Integration: sections → assign to draft', () => {
  it('should list, create section, and assign to draft', async () => {
    const RAW_SECTION = {
      id: 50,
      name: 'Fiction',
      slug: 'fiction',
      description: null,
      is_live: true,
      is_default_on: true,
      sibling_rank: 0,
    };

    server.use(
      http.get(`${API}/publication/sections`, () => HttpResponse.json([RAW_SECTION])),
      http.post(`${API}/publication/sections`, () =>
        HttpResponse.json({
          section: {
            id: 51,
            name: 'Essays',
            slug: 'essays',
            description: null,
            is_live: false,
            is_default_on: true,
            sibling_rank: 1,
          },
        }),
      ),
      http.get(`${API}/post_management/drafts`, () => HttpResponse.json(DRAFT_LIST_RESPONSE)),
      http.post(`${API}/drafts`, () => HttpResponse.json(RAW_DRAFT)),
      http.get(`${API}/drafts/100`, () => HttpResponse.json(RAW_DRAFT)),
      http.put(`${API}/drafts/100`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.draft_section_id).toBe(51);
        return HttpResponse.json({ ...RAW_DRAFT, draft_section_id: 51, section_id: 51 });
      }),
    );

    const client = createClient();

    const sections = await client.listSections();
    expect(sections).toHaveLength(1);

    const newSection = await client.createSection({ name: 'Essays' });
    expect(newSection.id).toBe(51);

    const draft = await client.createDraft({ title: 'With Section' });
    const updated = await client.updateDraft(draft.id, { sectionId: newSection.id });
    expect(updated.sectionId).toBe(51);
  });
});

describe('Integration: auth failure', () => {
  it('should throw SubstackAuthError on expired cookie', async () => {
    server.use(
      http.get(`${API}/post_management/drafts`, () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    );

    const client = createClient();
    await expect(client.listDrafts()).rejects.toThrow(SubstackAuthError);
  });
});

describe('Integration: retry flow', () => {
  it('should retry on 503 and succeed', async () => {
    let attempt = 0;

    server.use(
      http.get(`${API}/post_management/drafts`, () => {
        attempt++;
        if (attempt <= 2) {
          return HttpResponse.json({}, { status: 503 });
        }
        return HttpResponse.json(DRAFT_LIST_RESPONSE);
      }),
    );

    const client = new SubstackClient({
      publication: BASE_URL,
      sid: 'sid',
      maxRetries: 3,
      minRequestInterval: 0,
    });
    const result = await client.listDrafts();

    expect(result.drafts).toHaveLength(1);
    expect(attempt).toBe(3);
  });
});

describe('Integration: rate limit', () => {
  it('should respect Retry-After and succeed on retry', async () => {
    let attempt = 0;

    server.use(
      http.get(`${API}/drafts/100`, () => {
        attempt++;
        if (attempt === 1) {
          return HttpResponse.json({}, { status: 429, headers: { 'Retry-After': '1' } });
        }
        return HttpResponse.json(RAW_DRAFT);
      }),
    );

    const client = new SubstackClient({
      publication: BASE_URL,
      sid: 'sid',
      maxRetries: 2,
      minRequestInterval: 0,
    });
    const draft = await client.getDraft(100);

    expect(draft.id).toBe(100);
    expect(attempt).toBe(2);
  });
});

describe('Integration: not found', () => {
  it('should throw SubstackNotFoundError for non-existent draft', async () => {
    server.use(http.get(`${API}/drafts/999999`, () => HttpResponse.json({}, { status: 404 })));

    const client = createClient();
    await expect(client.getDraft(999999)).rejects.toThrow(SubstackNotFoundError);
  });
});
