import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../lib/http.js';
import { createSection, deleteSection, listSections, updateSection } from '../lib/sections.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

const RAW_SECTION = {
  id: 42,
  name: 'Fiction',
  slug: 'fiction',
  description: 'Short stories and novels',
  is_live: true,
  is_default_on: true,
  sibling_rank: 0,
};

describe('listSections', () => {
  it('should return array of Section objects', async () => {
    server.use(
      http.get(`${API}/publication/sections`, () =>
        HttpResponse.json([
          RAW_SECTION,
          { ...RAW_SECTION, id: 43, name: 'Essays', slug: 'essays', sibling_rank: 1 },
        ]),
      ),
    );

    const http_ = createHttpClient();
    const sections = await listSections(http_);

    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe(42);
    expect(sections[0].name).toBe('Fiction');
    expect(sections[0].slug).toBe('fiction');
    expect(sections[0].description).toBe('Short stories and novels');
    expect(sections[0].isLive).toBe(true);
    expect(sections[0].isDefaultOn).toBe(true);
    expect(sections[0].siblingRank).toBe(0);
    expect(sections[1].id).toBe(43);
  });
});

describe('createSection', () => {
  it('should send correct POST payload and return the created section', async () => {
    server.use(
      http.post(`${API}/publication/sections`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe('New Arc');
        expect(body.description).toBe('A new story arc');
        return HttpResponse.json({
          section: {
            id: 99,
            name: 'New Arc',
            slug: 'new-arc',
            description: 'A new story arc',
            is_live: false,
            is_default_on: true,
            sibling_rank: 5,
          },
        });
      }),
    );

    const http_ = createHttpClient();
    const section = await createSection(http_, { name: 'New Arc', description: 'A new story arc' });

    expect(section.id).toBe(99);
    expect(section.name).toBe('New Arc');
    expect(section.slug).toBe('new-arc');
    expect(section.isLive).toBe(false);
  });

  it('should omit description when not provided', async () => {
    server.use(
      http.post(`${API}/publication/sections`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe('Minimal');
        expect(body).not.toHaveProperty('description');
        return HttpResponse.json({
          section: {
            id: 100,
            name: 'Minimal',
            slug: 'minimal',
            description: null,
            is_live: false,
            is_default_on: true,
            sibling_rank: 6,
          },
        });
      }),
    );

    const http_ = createHttpClient();
    const section = await createSection(http_, { name: 'Minimal' });
    expect(section.name).toBe('Minimal');
  });
});

describe('updateSection', () => {
  it('should send PATCH request and return updated section', async () => {
    server.use(
      http.patch(`${API}/publication/sections/42`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.name).toBe('Updated Name');
        expect(body.description).toBe('Updated desc');
        return HttpResponse.json({
          section: {
            ...RAW_SECTION,
            name: 'Updated Name',
            description: 'Updated desc',
          },
        });
      }),
    );

    const http_ = createHttpClient();
    const section = await updateSection(http_, 42, {
      name: 'Updated Name',
      description: 'Updated desc',
    });

    expect(section.name).toBe('Updated Name');
    expect(section.slug).toBe('fiction'); // slug does NOT change
  });
});

describe('deleteSection', () => {
  it('should send DELETE request', async () => {
    let called = false;

    server.use(
      http.delete(`${API}/publication/sections/42`, () => {
        called = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const http_ = createHttpClient();
    await deleteSection(http_, 42);

    expect(called).toBe(true);
  });
});
