import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SubstackAuthError,
  SubstackError,
  SubstackNotFoundError,
  SubstackRateLimitError,
} from './errors.js';
import type { SubstackClientOptions } from './types.js';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MIN_REQUEST_INTERVAL = 500;
const RETRY_BASE_DELAY = 1_000;
const RETRY_MAX_DELAY = 30_000;

interface PackageJson {
  name: string;
  version: string;
}

function loadUserAgent(): string {
  const pkgPath = join(import.meta.dirname, '..', 'package.json');
  const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const shortName = pkg.name.replace(/^@[^/]+\//, '');

  return `${shortName}/${pkg.version}`;
}

const USER_AGENT = loadUserAgent();

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Internal HTTP client that handles authentication, retry, and error mapping.
 * Not part of the public API — used by domain modules (drafts, publish, sections).
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly cookieHeader: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly minRequestInterval: number;
  private readonly debug: boolean;
  private lastRequestTime = 0;

  constructor(options: SubstackClientOptions) {
    this.baseUrl = resolveBaseUrl(options.publication);
    this.cookieHeader = buildCookieHeader(options.sid, options.connectSid);
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.minRequestInterval = options.minRequestInterval ?? DEFAULT_MIN_REQUEST_INTERVAL;
    this.debug = options.debug ?? false;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>('GET', url);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>('POST', url, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>('PUT', url, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>('PATCH', url, body);
  }

  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>('DELETE', url);
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`/api/v1/${path.replace(/^\//, '')}`, this.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.calculateDelay(attempt, lastError);
        await sleep(delay);
      }

      try {
        const response = await this.sendRequest(method, url, body);

        if (response.ok) {
          const text = await response.text();
          if (!text) return undefined as T;
          return JSON.parse(text) as T;
        }

        const endpoint = `${method} ${url}`;
        const responseBody = await safeParseJson(response);

        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw this.mapError(response.status, endpoint, responseBody);
        }

        if (response.status === 429) {
          lastError = new SubstackRateLimitError(
            endpoint,
            parseRetryAfter(response.headers.get('retry-after')),
          );
        } else {
          lastError = new SubstackError(
            `HTTP ${response.status}`,
            response.status,
            endpoint,
            responseBody,
          );
        }

        this.log(`Attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${response.status}`);
      } catch (error) {
        if (error instanceof SubstackError && !RETRYABLE_STATUS_CODES.has(error.statusCode)) {
          throw error;
        }

        if (error instanceof TypeError || error instanceof DOMException) {
          lastError = error;
          this.log(`Attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${error.message}`);
          continue;
        }

        if (error instanceof SubstackError) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Request failed after all retries');
  }

  private async sendRequest(method: string, url: string, body?: unknown): Promise<Response> {
    // Proactive rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (this.lastRequestTime > 0 && elapsed < this.minRequestInterval) {
      await sleep(this.minRequestInterval - elapsed);
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        method,
        headers: {
          Cookie: this.cookieHeader,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapError(status: number, endpoint: string, responseBody?: unknown): SubstackError {
    switch (status) {
      case 401:
      case 403:
        return new SubstackAuthError(endpoint, status as 401 | 403, responseBody);
      case 404:
        return new SubstackNotFoundError(endpoint, responseBody);
      case 429:
        return new SubstackRateLimitError(endpoint);
      default:
        return new SubstackError(
          `Substack API error: HTTP ${status}`,
          status,
          endpoint,
          responseBody,
        );
    }
  }

  private calculateDelay(attempt: number, lastError?: Error): number {
    if (lastError instanceof SubstackRateLimitError && lastError.retryAfter) {
      return lastError.retryAfter * 1_000;
    }

    const exponential = RETRY_BASE_DELAY * 2 ** (attempt - 1);
    const capped = Math.min(exponential, RETRY_MAX_DELAY);
    const jitter = capped * (0.5 + Math.random() * 0.5);

    return jitter;
  }

  private log(message: string): void {
    if (this.debug) {
      console.debug(`[substack-client] ${message}`);
    }
  }
}

function resolveBaseUrl(publication: string): string {
  if (publication.startsWith('http://') || publication.startsWith('https://')) {
    return publication.replace(/\/$/, '');
  }

  // Handle bare subdomain (e.g. "readechoes" → "https://readechoes.substack.com")
  if (!publication.includes('.')) {
    return `https://${publication}.substack.com`;
  }

  return `https://${publication}`;
}

function buildCookieHeader(sid: string, connectSid?: string): string {
  const cookies = [`substack.sid=${sid}`];

  if (connectSid) {
    cookies.push(`connect.sid=${connectSid}`);
  }

  return cookies.join('; ');
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = Number.parseInt(header, 10);
  return Number.isNaN(seconds) ? undefined : seconds;
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
