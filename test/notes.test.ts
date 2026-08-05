import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../lib/http.js';
import { createNote, deleteNote, listNoteDrafts, listNotes } from '../lib/notes.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

describe('createNote', () => {
  it('should send correct bodyJson payload', async () => {
    server.use(
      http.post(`${API}/comment/feed`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const bodyJson = body.bodyJson as Record<string, unknown>;
        expect(bodyJson.type).toBe('doc');
        expect((bodyJson.attrs as Record<string, unknown>).schemaVersion).toBe('v1');
        expect(body.replyMinimumRole).toBe('everyone');
        return HttpResponse.json({ id: 12345, body: bodyJson });
      }),
    );

    const http_ = createHttpClient();
    const note = await createNote(http_, { text: 'Hello from API' });

    expect(note.id).toBe(12345);
  });

  it('should pass replyMinimumRole when specified', async () => {
    server.use(
      http.post(`${API}/comment/feed`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.replyMinimumRole).toBe('only_paid');
        return HttpResponse.json({ id: 12345, body: {} });
      }),
    );

    const http_ = createHttpClient();
    await createNote(http_, { text: 'Paid only replies', replyMinimumRole: 'only_paid' });
  });
});

describe('listNotes', () => {
  it('should return array of notes', async () => {
    server.use(
      http.get(`${API}/notes`, () =>
        HttpResponse.json({
          items: [
            { id: 1, body: {} },
            { id: 2, body: {} },
          ],
          nextCursor: null,
        }),
      ),
    );

    const http_ = createHttpClient();
    const notes = await listNotes(http_);

    expect(notes).toHaveLength(2);
    expect(notes[0].id).toBe(1);
  });
});

describe('listNoteDrafts', () => {
  it('should return note drafts with limit param', async () => {
    server.use(
      http.get(`${API}/feed/drafts`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('limit')).toBe('10');
        return HttpResponse.json({ drafts: [], hasMore: false, nextCursor: null });
      }),
    );

    const http_ = createHttpClient();
    const drafts = await listNoteDrafts(http_, 10);
    expect(drafts).toHaveLength(0);
  });
});

describe('deleteNote', () => {
  it('should send DELETE to /comment/:id', async () => {
    let called = false;

    server.use(
      http.delete(`${API}/comment/12345`, () => {
        called = true;
        return HttpResponse.json({});
      }),
    );

    const http_ = createHttpClient();
    await deleteNote(http_, 12345);
    expect(called).toBe(true);
  });
});
