import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../lib/http.js';
import { publish, schedule, scheduledRelease, unpublish, unschedule } from '../lib/publish.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

describe('publish', () => {
  it('should call prepublish then send POST with send:true by default', async () => {
    const calls: string[] = [];

    server.use(
      http.get(`${API}/drafts/123/prepublish`, () => {
        calls.push('prepublish');
        return HttpResponse.json({ ok: true });
      }),
      http.post(`${API}/drafts/123/publish`, async ({ request }) => {
        calls.push('publish');
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.send).toBe(true);
        return HttpResponse.json({ id: 123, is_published: true });
      }),
    );

    const http_ = createHttpClient();
    await publish(http_, 123);

    expect(calls).toEqual(['prepublish', 'publish']);
  });

  it('should pass send:false when specified', async () => {
    server.use(
      http.get(`${API}/drafts/123/prepublish`, () => HttpResponse.json({ ok: true })),
      http.post(`${API}/drafts/123/publish`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.send).toBe(false);
        return HttpResponse.json({ id: 123, is_published: true });
      }),
    );

    const http_ = createHttpClient();
    await publish(http_, 123, { send: false });
  });
});

describe('schedule', () => {
  it('should send payload to /scheduled_release endpoint', async () => {
    server.use(
      http.post(`${API}/drafts/456/scheduled_release`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.trigger_at).toBe('2026-09-01T09:00:00Z');
        expect(body.post_audience).toBe('only_paid');
        return HttpResponse.json({ id: 456 });
      }),
    );

    const http_ = createHttpClient();
    await schedule(http_, 456, { date: '2026-09-01T09:00:00Z', audience: 'only_paid' });
  });

  it('should default audience to everyone', async () => {
    server.use(
      http.post(`${API}/drafts/456/scheduled_release`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.post_audience).toBe('everyone');
        return HttpResponse.json({ id: 456 });
      }),
    );

    const http_ = createHttpClient();
    await schedule(http_, 456, { date: '2026-09-01T09:00:00Z' });
  });
});

describe('unschedule', () => {
  it('should send DELETE to /scheduled_release and return cancelled IDs', async () => {
    server.use(
      http.delete(`${API}/drafts/456/scheduled_release`, () => HttpResponse.json([11890474])),
    );

    const http_ = createHttpClient();
    const result = await unschedule(http_, 456);

    expect(result).toEqual([11890474]);
  });
});

describe('unpublish', () => {
  it('should send POST to unpublish endpoint (no body)', async () => {
    let called = false;

    server.use(
      http.post(`${API}/drafts/123/unpublish`, () => {
        called = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const http_ = createHttpClient();
    await unpublish(http_, 123);

    expect(called).toBe(true);
  });
});

describe('scheduledRelease', () => {
  it('should send correct payload to /drafts/:id/scheduled_release', async () => {
    server.use(
      http.post(`${API}/drafts/789/scheduled_release`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.trigger_at).toBe('2026-07-13T18:00:00.000Z');
        expect(body.post_audience).toBe('founding');
        expect(body.email_audience).toBe('founding');
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const http_ = createHttpClient();
    await scheduledRelease(http_, 789, {
      date: '2026-07-13T18:00:00.000Z',
      postAudience: 'founding',
      emailAudience: 'founding',
    });
  });

  it('should support only_free as email audience', async () => {
    server.use(
      http.post(`${API}/drafts/789/scheduled_release`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.post_audience).toBe('everyone');
        expect(body.email_audience).toBe('only_free');
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const http_ = createHttpClient();
    await scheduledRelease(http_, 789, {
      date: '2026-07-20T18:00:00.000Z',
      postAudience: 'everyone',
      emailAudience: 'only_free',
    });
  });
});
