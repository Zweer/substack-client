import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpClient } from '../lib/http.js';
import { uploadImage } from '../lib/images.js';

const BASE_URL = 'https://test.substack.com';
const API = `${BASE_URL}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createHttpClient(): HttpClient {
  return new HttpClient({ publication: BASE_URL, sid: 'test-sid', minRequestInterval: 0 });
}

const CDN_URL = 'https://substack-post-media.s3.amazonaws.com/public/images/test-123.jpeg';

const FULL_RESPONSE = {
  id: 319287167,
  url: CDN_URL,
  contentType: 'image/jpeg',
  bytes: 4096,
  imageWidth: 800,
  imageHeight: 600,
};

describe('uploadImage', () => {
  it('should upload a file path as base64 data URI and return full metadata', async () => {
    const testFile = join(tmpdir(), 'test-upload.jpg');
    writeFileSync(testFile, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

    server.use(
      http.post(`${API}/image`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const image = body.image as string;
        expect(image).toMatch(/^data:image\/jpeg;base64,/);
        return HttpResponse.json(FULL_RESPONSE);
      }),
    );

    const http_ = createHttpClient();
    const result = await uploadImage(http_, testFile);

    expect(result.id).toBe(319287167);
    expect(result.url).toBe(CDN_URL);
    expect(result.contentType).toBe('image/jpeg');
    expect(result.bytes).toBe(4096);
    expect(result.imageWidth).toBe(800);
    expect(result.imageHeight).toBe(600);
  });

  it('should upload a PNG file with correct mime type', async () => {
    const testFile = join(tmpdir(), 'test-upload.png');
    writeFileSync(testFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    server.use(
      http.post(`${API}/image`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const image = body.image as string;
        expect(image).toMatch(/^data:image\/png;base64,/);
        return HttpResponse.json({ ...FULL_RESPONSE, contentType: 'image/png' });
      }),
    );

    const http_ = createHttpClient();
    const result = await uploadImage(http_, testFile);
    expect(result.contentType).toBe('image/png');
  });

  it('should upload a Buffer with custom mime type', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    server.use(
      http.post(`${API}/image`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const image = body.image as string;
        expect(image).toMatch(/^data:image\/webp;base64,/);
        return HttpResponse.json(FULL_RESPONSE);
      }),
    );

    const http_ = createHttpClient();
    const result = await uploadImage(http_, buffer, 'image/webp');
    expect(result.url).toBe(CDN_URL);
  });
});
