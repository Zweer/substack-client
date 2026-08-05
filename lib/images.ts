import { readFileSync } from 'node:fs';

import type { HttpClient } from './http.js';
import type { ImageUploadResult } from './types.js';

interface RawImageResponse {
  id: number;
  url: string;
  contentType: string;
  bytes: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Upload an image to Substack's CDN.
 *
 * Accepts either a file path or a Buffer.
 * Substack uses JSON with base64 data URI format (NOT multipart form).
 * Returns the full image metadata including CDN URL.
 *
 * @param input - File path (string) or image Buffer
 * @param mimeType - MIME type override when using Buffer (default: 'image/jpeg')
 */
export async function uploadImage(
  http: HttpClient,
  input: string | Buffer,
  mimeType?: string,
): Promise<ImageUploadResult> {
  let base64Data: string;
  let resolvedMime = mimeType ?? 'image/jpeg';

  if (typeof input === 'string') {
    const buffer = readFileSync(input);
    base64Data = buffer.toString('base64');

    if (!mimeType) {
      if (input.endsWith('.png')) resolvedMime = 'image/png';
      else if (input.endsWith('.gif')) resolvedMime = 'image/gif';
      else if (input.endsWith('.webp')) resolvedMime = 'image/webp';
    }
  } else {
    base64Data = input.toString('base64');
  }

  const dataUri = `data:${resolvedMime};base64,${base64Data}`;

  const response = await http.post<RawImageResponse>('image', { image: dataUri });

  return {
    id: response.id,
    url: response.url,
    contentType: response.contentType,
    bytes: response.bytes,
    imageWidth: response.imageWidth,
    imageHeight: response.imageHeight,
  };
}
