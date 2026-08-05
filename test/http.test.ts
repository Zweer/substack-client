import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  SubstackAuthError,
  SubstackError,
  SubstackNotFoundError,
  SubstackRateLimitError,
} from '../lib/errors.js';
import { HttpClient } from '../lib/http.js';

const BASE_URL = 'https://test.substack.com';
const API_PREFIX = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('HttpClient', () => {
  describe('URL resolution', () => {
    it('should resolve bare domain to https URL', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, ({ request }) => {
          expect(request.url).toBe(`${API_PREFIX}/drafts`);
          return HttpResponse.json({ ok: true });
        }),
      );

      const client = new HttpClient({
        publication: 'test.substack.com',
        sid: 's',
        minRequestInterval: 0,
      });
      await client.get('drafts');
    });

    it('should resolve full https URL', async () => {
      server.use(http.get(`${API_PREFIX}/drafts`, () => HttpResponse.json({ ok: true })));

      const client = new HttpClient({
        publication: 'https://test.substack.com',
        sid: 's',
        minRequestInterval: 0,
      });
      await client.get('drafts');
    });

    it('should resolve bare subdomain name (no dots)', async () => {
      server.use(http.get(`${API_PREFIX}/drafts`, () => HttpResponse.json({ ok: true })));

      const client = new HttpClient({
        publication: 'test',
        sid: 's',
        minRequestInterval: 0,
      });
      await client.get('drafts');
    });
  });

  describe('cookie injection', () => {
    it('should inject substack.sid cookie in all requests', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, ({ request }) => {
          expect(request.headers.get('cookie')).toContain('substack.sid=my-sid');
          return HttpResponse.json({});
        }),
      );

      const client = new HttpClient({
        publication: BASE_URL,
        sid: 'my-sid',
        minRequestInterval: 0,
      });
      await client.get('drafts');
    });

    it('should inject connect.sid when provided', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, ({ request }) => {
          const cookie = request.headers.get('cookie');
          expect(cookie).toContain('substack.sid=my-sid');
          expect(cookie).toContain('connect.sid=my-connect');
          return HttpResponse.json({});
        }),
      );

      const client = new HttpClient({
        publication: BASE_URL,
        sid: 'my-sid',
        connectSid: 'my-connect',
        minRequestInterval: 0,
      });
      await client.get('drafts');
    });
  });

  describe('error mapping', () => {
    it('should throw SubstackAuthError on 401', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, () =>
          HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
        ),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      await expect(client.get('drafts')).rejects.toThrow(SubstackAuthError);
    });

    it('should throw SubstackAuthError on 403', async () => {
      server.use(http.get(`${API_PREFIX}/drafts`, () => HttpResponse.json({}, { status: 403 })));

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      await expect(client.get('drafts')).rejects.toThrow(SubstackAuthError);
    });

    it('should throw SubstackNotFoundError on 404', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts/999`, () => HttpResponse.json({}, { status: 404 })),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      await expect(client.get('drafts/999')).rejects.toThrow(SubstackNotFoundError);
    });

    it('should throw SubstackRateLimitError on 429', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, () =>
          HttpResponse.json({}, { status: 429, headers: { 'Retry-After': '30' } }),
        ),
      );

      const client = new HttpClient({
        publication: BASE_URL,
        sid: 's',
        maxRetries: 0,
        minRequestInterval: 0,
      });
      await expect(client.get('drafts')).rejects.toThrow(SubstackRateLimitError);
    });

    it('should throw SubstackError on other 4xx', async () => {
      server.use(http.get(`${API_PREFIX}/drafts`, () => HttpResponse.json({}, { status: 422 })));

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      const error = await client.get('drafts').catch((e: SubstackError) => e);

      expect(error).toBeInstanceOf(SubstackError);
      expect(error.statusCode).toBe(422);
    });

    it('should NOT retry on 400', async () => {
      let callCount = 0;

      server.use(
        http.get(`${API_PREFIX}/drafts`, () => {
          callCount++;
          return HttpResponse.json({}, { status: 400 });
        }),
      );

      const client = new HttpClient({
        publication: BASE_URL,
        sid: 's',
        maxRetries: 3,
        minRequestInterval: 0,
      });
      await expect(client.get('drafts')).rejects.toThrow(SubstackError);
      expect(callCount).toBe(1);
    });
  });

  describe('retry behavior', () => {
    it('should retry on 503 and succeed on second attempt', async () => {
      let callCount = 0;

      server.use(
        http.get(`${API_PREFIX}/drafts`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({}, { status: 503 });
          }
          return HttpResponse.json({ success: true });
        }),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      const result = await client.get<{ success: boolean }>('drafts');

      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    });

    it('should give up after maxRetries attempts', async () => {
      let callCount = 0;

      server.use(
        http.get(`${API_PREFIX}/drafts`, () => {
          callCount++;
          return HttpResponse.json({}, { status: 503 });
        }),
      );

      const client = new HttpClient({
        publication: BASE_URL,
        sid: 's',
        maxRetries: 2,
        minRequestInterval: 0,
      });
      await expect(client.get('drafts')).rejects.toThrow(SubstackError);
      expect(callCount).toBe(3); // initial + 2 retries
    });

    it('should respect Retry-After header on 429', async () => {
      let callCount = 0;

      server.use(
        http.get(`${API_PREFIX}/drafts`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({}, { status: 429, headers: { 'Retry-After': '1' } });
          }
          return HttpResponse.json({ ok: true });
        }),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      const start = Date.now();
      await client.get('drafts');
      const elapsed = Date.now() - start;

      expect(callCount).toBe(2);
      expect(elapsed).toBeGreaterThanOrEqual(900); // ~1s with some tolerance
    });
  });

  describe('timeout', () => {
    it('should abort request on timeout', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return HttpResponse.json({});
        }),
      );

      const client = new HttpClient({
        publication: BASE_URL,
        sid: 's',
        timeout: 100,
        maxRetries: 0,
        minRequestInterval: 0,
      });
      await expect(client.get('drafts')).rejects.toThrow();
    });
  });

  describe('HTTP methods', () => {
    it('should send POST with JSON body', async () => {
      server.use(
        http.post(`${API_PREFIX}/drafts`, async ({ request }) => {
          const body = await request.json();
          expect(body).toEqual({ title: 'Hello' });
          return HttpResponse.json({ id: 1 });
        }),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      const result = await client.post<{ id: number }>('drafts', { title: 'Hello' });
      expect(result.id).toBe(1);
    });

    it('should send PUT with JSON body', async () => {
      server.use(
        http.put(`${API_PREFIX}/drafts/1`, async ({ request }) => {
          const body = await request.json();
          expect(body).toEqual({ draft_title: 'Updated' });
          return HttpResponse.json({ id: 1 });
        }),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      const result = await client.put<{ id: number }>('drafts/1', { draft_title: 'Updated' });
      expect(result.id).toBe(1);
    });

    it('should send DELETE', async () => {
      server.use(http.delete(`${API_PREFIX}/drafts/1`, () => HttpResponse.json({ deleted: true })));

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      const result = await client.delete<{ deleted: boolean }>('drafts/1');
      expect(result.deleted).toBe(true);
    });

    it('should pass query params on GET', async () => {
      server.use(
        http.get(`${API_PREFIX}/drafts`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('offset')).toBe('10');
          expect(url.searchParams.get('limit')).toBe('5');
          return HttpResponse.json([]);
        }),
      );

      const client = new HttpClient({ publication: BASE_URL, sid: 's', minRequestInterval: 0 });
      await client.get('drafts', { offset: '10', limit: '5' });
    });
  });
});
