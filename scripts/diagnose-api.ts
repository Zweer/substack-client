#!/usr/bin/env npx tsx

/**
 * Diagnostic script — inspects raw Substack API responses to understand the real format.
 *
 * Usage:
 *   SUBSTACK_SID="s%3A..." SUBSTACK_PUBLICATION="yourname.substack.com" npx tsx scripts/diagnose-api.ts
 */

const SID = process.env.SUBSTACK_SID;
const PUBLICATION = process.env.SUBSTACK_PUBLICATION;

if (!SID || !PUBLICATION) {
  console.error('Missing SUBSTACK_SID or SUBSTACK_PUBLICATION');
  process.exit(1);
}

const baseUrl = `https://${PUBLICATION}/api/v1`;
const cookie = `substack.sid=${SID}`;

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${baseUrl}/${path}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${method} ${url}`);
  if (body) console.log('Request body:', JSON.stringify(body, null, 2));
  console.log('');

  const res = await fetch(url, {
    method,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'User-Agent': 'substack-client-diagnostic/0.1',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    console.log('Response (JSON):');
    console.log(JSON.stringify(parsed, null, 2).slice(0, 3000));
    if (JSON.stringify(parsed).length > 3000) console.log('... (truncated)');
  } catch {
    console.log('Response (raw text):');
    console.log(text.slice(0, 2000));
  }

  return parsed;
}

async function main(): Promise<void> {
  console.log('🔍 Substack API Diagnostic');
  console.log(`   Publication: ${PUBLICATION}`);
  console.log(`   Base URL: ${baseUrl}`);

  // 1. List drafts — what shape does this return?
  console.log('\n\n📋 TEST 1: GET /drafts (list)');
  await apiCall('GET', 'drafts');

  // 2. Try creating a draft with our current payload
  console.log('\n\n📋 TEST 2: POST /drafts (our current payload: title + type)');
  const result2 = await apiCall('POST', 'drafts', {
    title: '[Diagnostic] Test with title+type',
    type: 'newsletter',
  });

  // 3. Try creating with python-substack's format
  console.log(
    '\n\n📋 TEST 3: POST /drafts (python-substack format: draft_title + draft_body + draft_bylines + audience)',
  );
  const result3 = await apiCall('POST', 'drafts', {
    draft_title: '[Diagnostic] Test python-substack format',
    draft_subtitle: '',
    draft_body: JSON.stringify({ type: 'doc', content: [] }),
    draft_bylines: [],
    audience: 'everyone',
    section_chosen: true,
  });

  // 4. Try minimal — just draft_title
  console.log('\n\n📋 TEST 4: POST /drafts (minimal: just draft_title)');
  const result4 = await apiCall('POST', 'drafts', {
    draft_title: '[Diagnostic] Minimal test',
  });

  // 5. Cleanup — delete any drafts we created
  console.log('\n\n🧹 CLEANUP');
  for (const result of [result2, result3, result4]) {
    if (result && typeof result === 'object' && 'id' in result) {
      const id = (result as { id: number }).id;
      console.log(`  Deleting draft ${id}...`);
      await apiCall('DELETE', `drafts/${id}`);
    }
  }

  console.log('\n\n✅ Done');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
