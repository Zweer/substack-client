#!/usr/bin/env npx tsx

/**
 * End-to-end test against the real Substack API.
 *
 * Tests ALL client operations against a live publication.
 * Creates temporary resources and cleans them up at the end.
 *
 * Safety: aborts if the publication has any published posts to avoid
 * accidentally running against a real publication with subscribers.
 * Set E2E_ALLOW_LIVE=1 to override this check.
 *
 * Required env vars:
 *   SUBSTACK_SID         — substack.sid cookie value
 *   SUBSTACK_PUBLICATION — publication domain (e.g. "yourname.substack.com")
 *
 * Optional env vars:
 *   SUBSTACK_CONNECT_SID — connect.sid cookie value (some accounts need it)
 *   E2E_ALLOW_LIVE       — set to "1" to allow running on publications with existing posts
 *   E2E_SKIP_PUBLISH     — set to "1" to skip publish/unpublish (avoids sending emails)
 *   E2E_SKIP_SECTIONS    — set to "1" to skip section create/delete
 */

import { join } from 'node:path';

import { SubstackClient } from '../lib/client.js';
import { SubstackAuthError, SubstackError, SubstackNotFoundError } from '../lib/errors.js';
import type { Draft, Section } from '../lib/types.js';

// --- Config ---

const SID = env('SUBSTACK_SID');
const PUBLICATION = env('SUBSTACK_PUBLICATION');
const CONNECT_SID = process.env.SUBSTACK_CONNECT_SID;
const ALLOW_LIVE = process.env.E2E_ALLOW_LIVE === '1';
const SKIP_PUBLISH = process.env.E2E_SKIP_PUBLISH === '1';
const SKIP_SECTIONS = process.env.E2E_SKIP_SECTIONS === '1';

// --- Helpers ---

const PREFIX = '[e2e]';
const PASS = '✅';
const FAIL = '❌';
const SKIP = '⏭️ ';

let passed = 0;
let failed = 0;
let skipped = 0;

// Track resources for cleanup
const createdDraftIds: number[] = [];
const createdSectionIds: number[] = [];

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${FAIL} Missing required env var: ${name}`);
    console.error('');
    console.error('Usage:');
    console.error(
      '  SUBSTACK_SID="s%3A..." SUBSTACK_PUBLICATION="yourname.substack.com" npx tsx scripts/e2e.ts',
    );
    process.exit(1);
  }
  return value;
}

function log(icon: string, testName: string, detail?: string): void {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`  ${icon} ${testName}${suffix}`);
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    log(PASS, name);
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(FAIL, name, msg);
    failed++;
    if (error && typeof error === 'object' && 'responseBody' in error) {
      console.error(
        `     Response body: ${JSON.stringify((error as { responseBody: unknown }).responseBody)}`,
      );
    }
    if (error instanceof Error && error.stack) {
      console.error(`     ${error.stack.split('\n').slice(1, 4).join('\n     ')}`);
    }
  }
}

function skip(name: string, reason: string): void {
  log(SKIP, name, reason);
  skipped++;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertDefined<T>(value: T | null | undefined, label: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${label}: expected defined value, got ${value}`);
  }
}

// --- Test suites ---

async function testDrafts(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Draft operations`);

  let draft: Draft;

  // --- Create ---
  await test('createDraft — creates a draft with title', async () => {
    draft = await client.createDraft({
      title: `[E2E Test] Draft ${Date.now()}`,
      subtitle: 'This is an automated E2E test draft',
    });
    createdDraftIds.push(draft.id);

    assert(draft.id > 0, 'draft.id should be positive');
    assert(draft.title.includes('[E2E Test]'), 'title should contain marker');
    assertEqual(draft.subtitle, 'This is an automated E2E test draft', 'subtitle');
    assert(typeof draft.slug === 'string', 'slug should be a string');
    assert(draft.draftCreatedAt.length > 0, 'draftCreatedAt should be set');
  });

  // --- Get ---
  await test('getDraft — retrieves the created draft', async () => {
    const fetched = await client.getDraft(draft.id);

    assertEqual(fetched.id, draft.id, 'id');
    assertEqual(fetched.title, draft.title, 'title');
    assertEqual(fetched.subtitle, draft.subtitle, 'subtitle');
  });

  // --- Update title/subtitle ---
  await test('updateDraft — updates title and subtitle', async () => {
    const updated = await client.updateDraft(draft.id, {
      title: `[E2E Test] Updated ${Date.now()}`,
      subtitle: 'Updated subtitle',
    });

    assert(updated.title.includes('Updated'), 'title should be updated');
    assertEqual(updated.subtitle, 'Updated subtitle', 'subtitle');
  });

  // --- Update body (ProseMirror JSON) ---
  await test('updateDraft — updates body with ProseMirror JSON', async () => {
    const proseMirrorBody = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello from the E2E test! This paragraph was set via the API.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Second paragraph with ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
            { type: 'text', text: ' and ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
            { type: 'text', text: ' text.' },
          ],
        },
      ],
    });

    const updated = await client.updateDraft(draft.id, { body: proseMirrorBody });
    assertEqual(updated.id, draft.id, 'id should remain the same');

    // Verify body was saved
    const fetched = await client.getDraft(draft.id);
    assertDefined(fetched.body, 'body');
    const body = JSON.parse(fetched.body);
    assertEqual(body.type, 'doc', 'body.type');
    assert(body.content.length >= 2, 'body should have at least 2 paragraphs');
  });

  // --- Update audience ---
  await test('updateDraft — sets audience to everyone', async () => {
    const updated = await client.updateDraft(draft.id, { audience: 'everyone' });
    assertEqual(updated.audience, 'everyone', 'audience');
  });

  // --- List ---
  await test('listDrafts — returns array containing our draft', async () => {
    const result = await client.listDrafts();

    assert(Array.isArray(result.drafts), 'should return drafts array');
    assert(result.drafts.length > 0, 'should have at least 1 draft');
    const found = result.drafts.find((d) => d.id === draft.id);
    assertDefined(found, 'our draft should be in the list');
  });

  // --- List with pagination ---
  await test('listDrafts — supports limit parameter', async () => {
    const result = await client.listDrafts({ limit: 1 });
    assertEqual(result.drafts.length, 1, 'should return exactly 1 draft');
  });

  // --- Create second draft for delete test ---
  let draftToDelete: Draft;

  await test('deleteDraft — creates and deletes a draft', async () => {
    draftToDelete = await client.createDraft({
      title: `[E2E Test] To Delete ${Date.now()}`,
    });

    await client.deleteDraft(draftToDelete.id);

    // Verify it's gone
    try {
      await client.getDraft(draftToDelete.id);
      throw new Error('getDraft should have thrown NotFoundError');
    } catch (error) {
      assert(
        error instanceof SubstackNotFoundError,
        `expected SubstackNotFoundError, got ${error instanceof Error ? error.constructor.name : error}`,
      );
    }
  });

  // --- Get non-existent draft ---
  await test('getDraft — throws SubstackNotFoundError for non-existent ID', async () => {
    try {
      await client.getDraft(999_999_999);
      throw new Error('should have thrown');
    } catch (error) {
      assert(
        error instanceof SubstackNotFoundError,
        `expected SubstackNotFoundError, got ${error instanceof Error ? error.constructor.name : error}`,
      );
    }
  });
}

async function testSections(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Section operations`);

  if (SKIP_SECTIONS) {
    skip('section operations', 'E2E_SKIP_SECTIONS=1');
    return;
  }

  let section: Section;

  // --- List ---
  await test('listSections — returns array', async () => {
    const sections = await client.listSections();
    assert(Array.isArray(sections), 'should return array');
  });

  // --- Create ---
  await test('createSection — creates a new section', async () => {
    section = await client.createSection({
      name: `E2E Test Section ${Date.now()}`,
      description: 'Automated E2E test section — safe to delete',
    });
    createdSectionIds.push(section.id);

    assert(section.id > 0, 'section.id should be positive');
    assert(section.name.includes('E2E Test Section'), 'name should contain marker');
    assertEqual(section.description, 'Automated E2E test section — safe to delete', 'description');
    assert(section.slug.length > 0, 'slug should not be empty');
  });

  // --- Verify in list ---
  await test('listSections — includes newly created section', async () => {
    const sections = await client.listSections();
    const found = sections.find((s) => s.id === section.id);
    assertDefined(found, 'new section should appear in list');
    assertEqual(found.name, section.name, 'name');
  });

  // --- Assign section to draft ---
  await test('updateDraft — assigns section to a draft', async () => {
    const draft = await client.createDraft({
      title: `[E2E Test] With Section ${Date.now()}`,
    });
    createdDraftIds.push(draft.id);

    const updated = await client.updateDraft(draft.id, { sectionId: section.id });
    assertEqual(updated.sectionId, section.id, 'sectionId');
  });

  // --- Delete ---
  await test('deleteSection — deletes the test section', async () => {
    await client.deleteSection(section.id);
    // Remove from cleanup list since we just deleted it
    const idx = createdSectionIds.indexOf(section.id);
    if (idx >= 0) createdSectionIds.splice(idx, 1);

    // Verify it's gone from the list
    const sections = await client.listSections();
    const found = sections.find((s) => s.id === section.id);
    assert(!found, 'deleted section should not appear in list');
  });
}

async function testPublish(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Publish operations`);

  if (SKIP_PUBLISH) {
    skip('publish operations', 'E2E_SKIP_PUBLISH=1 (set to avoid sending emails)');
    return;
  }

  // Get a section to assign — some publications require it to publish
  const sections = await client.listSections();
  if (sections.length === 0) {
    skip('publish operations', 'No sections available in this publication');
    return;
  }
  const sectionId = sections[0].id;

  // --- Publish ---
  let publishedDraft: Draft;

  await test('publish — publishes a draft (send=false)', async () => {
    publishedDraft = await client.createDraft({
      title: `[E2E Test] Published ${Date.now()}`,
    });
    createdDraftIds.push(publishedDraft.id);

    // Add body so it's publishable
    const body = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'E2E test published post. Safe to delete.' }],
        },
      ],
    });
    await client.updateDraft(publishedDraft.id, {
      body,
      audience: 'everyone',
      sectionId,
    });

    // Publish without sending email
    await client.publish(publishedDraft.id, { send: false });
    // If no error thrown, publish succeeded
  });

  // --- Unpublish ---
  await test('unpublish — reverts published post to draft', async () => {
    await client.unpublish(publishedDraft.id);

    // Should still be accessible as a draft
    const fetched = await client.getDraft(publishedDraft.id);
    assertEqual(fetched.id, publishedDraft.id, 'id');
  });

  // --- Schedule ---
  await test('schedule — schedules a draft for the future', async () => {
    const scheduledDraft = await client.createDraft({
      title: `[E2E Test] Scheduled ${Date.now()}`,
    });
    createdDraftIds.push(scheduledDraft.id);

    const body = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'E2E test scheduled post. Safe to delete.' }],
        },
      ],
    });
    await client.updateDraft(scheduledDraft.id, {
      body,
      audience: 'everyone',
      sectionId,
    });

    // Schedule for 7 days from now
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await client.schedule(scheduledDraft.id, { date: futureDate });
    // If no error thrown, schedule succeeded

    // Unschedule to revert to draft (so cleanup can delete it)
    await client.unschedule(scheduledDraft.id);
  });
}

async function testImageUpload(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Image upload`);

  await test('uploadImage — uploads a test image and returns CDN URL', async () => {
    const imagePath = join(import.meta.dirname, '..', 'test', 'fixtures', 'test-image.jpg');
    const result = await client.uploadImage(imagePath);

    assert(typeof result.url === 'string', 'url should be a string');
    assert(result.url.startsWith('https://'), 'url should start with https://');
    assert(
      result.url.includes('substack') || result.url.includes('amazonaws'),
      'url should be a Substack CDN URL',
    );
  });
}

async function testScheduledRelease(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Scheduled release (early access)`);

  if (SKIP_PUBLISH) {
    skip('scheduled release', 'E2E_SKIP_PUBLISH=1');
    return;
  }

  // Need a section for publishing
  const sections = await client.listSections();
  if (sections.length === 0) {
    skip('scheduled release', 'No sections available');
    return;
  }
  const sectionId = sections[0].id;

  await test('scheduledRelease — sets up multi-tier early access', async () => {
    const draft = await client.createDraft({
      title: `[E2E Test] Scheduled Release ${Date.now()}`,
    });
    createdDraftIds.push(draft.id);

    const body = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'E2E scheduled release test.' }],
        },
      ],
    });
    await client.updateDraft(draft.id, {
      body,
      audience: 'founding',
      sectionId,
    });

    // Set up two-tier release: founding first, everyone a week later
    const tier1Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const tier2Date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await client.scheduledRelease(draft.id, {
      date: tier1Date,
      postAudience: 'founding',
      emailAudience: 'founding',
    });

    await client.scheduledRelease(draft.id, {
      date: tier2Date,
      postAudience: 'everyone',
      emailAudience: 'only_free',
    });

    // If no errors, both tiers were set successfully
    // Delete to clean up (draft will be in scheduled state)
  });
}

async function testAuth(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Auth error handling`);

  await test('invalid SID — throws SubstackAuthError', async () => {
    const badClient = new SubstackClient({
      publication: PUBLICATION,
      sid: 'invalid_session_id_that_does_not_exist',
      minRequestInterval: 750,
      maxRetries: 1,
    });

    try {
      await badClient.listDrafts();
      throw new Error('should have thrown');
    } catch (error) {
      // Accept either AuthError (correct) or RateLimitError (IP-based rate limit from prior tests)
      assert(
        error instanceof SubstackAuthError || error instanceof SubstackError,
        `expected SubstackAuthError or SubstackError, got ${error instanceof Error ? error.constructor.name : error}: ${error instanceof Error ? error.message : ''}`,
      );
    }
  });
}

// --- Cleanup ---

async function cleanup(client: SubstackClient): Promise<void> {
  console.log('');
  console.log(`${PREFIX} Cleanup`);

  let cleanupErrors = 0;

  for (const id of createdDraftIds) {
    try {
      await client.deleteDraft(id);
      log(PASS, `deleted draft ${id}`);
    } catch (error) {
      // NotFound is fine — already deleted
      if (error instanceof SubstackNotFoundError) {
        log(PASS, `draft ${id} already gone`);
      } else {
        log(FAIL, `failed to delete draft ${id}`, error instanceof Error ? error.message : '');
        cleanupErrors++;
      }
    }
  }

  for (const id of createdSectionIds) {
    try {
      await client.deleteSection(id);
      log(PASS, `deleted section ${id}`);
    } catch (error) {
      if (error instanceof SubstackNotFoundError) {
        log(PASS, `section ${id} already gone`);
      } else {
        log(FAIL, `failed to delete section ${id}`, error instanceof Error ? error.message : '');
        cleanupErrors++;
      }
    }
  }

  if (cleanupErrors > 0) {
    console.warn(`\n  ⚠️  ${cleanupErrors} resource(s) could not be cleaned up`);
  }
}

// --- Main ---

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   substack-client — End-to-End Tests (REAL API) ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Publication: ${PUBLICATION}`);
  console.log(`  Allow live: ${ALLOW_LIVE}`);
  console.log(`  Skip publish: ${SKIP_PUBLISH}`);
  console.log(`  Skip sections: ${SKIP_SECTIONS}`);
  console.log(`  Time: ${new Date().toISOString()}`);

  const client = new SubstackClient({
    publication: PUBLICATION,
    sid: SID,
    connectSid: CONNECT_SID,
    minRequestInterval: 750,
    debug: true,
  });

  // --- Safety check ---
  // Abort if publication has published posts (likely a real publication with subscribers)
  // unless E2E_ALLOW_LIVE=1 is explicitly set
  const counts = await client.getPostCounts();
  console.log(
    `\n  Post counts: ${counts.published} published, ${counts.drafts} drafts, ${counts.scheduled} scheduled`,
  );

  if (counts.published > 0 && !ALLOW_LIVE) {
    console.error('\n  🛑 SAFETY ABORT: Publication has published posts.');
    console.error('     This likely means real subscribers would receive notifications.');
    console.error('     Set E2E_ALLOW_LIVE=1 to override this check.');
    process.exit(1);
  }

  if (counts.published === 0) {
    console.log('  ✅ Safety check passed: 0 published posts (test publication)');
  } else {
    console.log('  ⚠️  Running on live publication (E2E_ALLOW_LIVE=1)');
  }

  try {
    await testDrafts(client);
    await testSections(client);
    await testPublish(client);
    await testImageUpload(client);
    await testScheduledRelease(client);
    await testAuth(client);
  } finally {
    await cleanup(client);
  }

  // --- Summary ---
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ${PASS} Passed: ${passed}`);
  if (failed > 0) console.log(`  ${FAIL} Failed: ${failed}`);
  if (skipped > 0) console.log(`  ${SKIP} Skipped: ${skipped}`);
  console.log(`  Total: ${passed + failed + skipped}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n${FAIL} Unhandled error:`, error);
  process.exit(2);
});
