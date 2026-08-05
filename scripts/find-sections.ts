#!/usr/bin/env npx tsx

/**
 * Diagnostic: find the sections endpoint.
 *
 * Usage:
 *   SUBSTACK_SID="s%3A..." SUBSTACK_PUBLICATION="yourname.substack.com" npx tsx scripts/find-sections.ts
 */

const SID = process.env.SUBSTACK_SID;
const PUBLICATION = process.env.SUBSTACK_PUBLICATION;

if (!SID || !PUBLICATION) {
  console.error('Missing SUBSTACK_SID or SUBSTACK_PUBLICATION');
  process.exit(1);
}

const baseUrl = `https://${PUBLICATION}/api/v1`;
const cookie = `substack.sid=${SID}`;

async function tryEndpoint(path: string): Promise<void> {
  const url = `${baseUrl}/${path}`;
  console.log(`\nGET ${path}`);

  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'User-Agent': 'substack-client-diagnostic/0.1',
    },
  });

  console.log(`  Status: ${res.status}`);
  if (res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      // Show structure
      if (Array.isArray(data)) {
        console.log(`  Array of ${data.length} items`);
        if (data.length > 0) {
          console.log(`  First item keys: ${Object.keys(data[0]).join(', ')}`);
          console.log(`  First item:`, JSON.stringify(data[0]).slice(0, 300));
        }
      } else if (typeof data === 'object') {
        console.log(`  Object keys: ${Object.keys(data).join(', ')}`);
        // Look for section-related keys
        for (const [k, v] of Object.entries(data)) {
          if (k.toLowerCase().includes('section')) {
            console.log(`  ${k}:`, JSON.stringify(v).slice(0, 500));
          }
        }
        console.log(`  Preview:`, JSON.stringify(data).slice(0, 500));
      }
    } catch {
      console.log(`  Raw: ${text.slice(0, 300)}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('🔍 Finding sections endpoint');
  console.log(`   Publication: ${PUBLICATION}`);

  // Try various possible endpoints
  await tryEndpoint('sections');
  await tryEndpoint('publication/sections');
  await tryEndpoint('publication/post-tag');

  // Test POST to create a section
  console.log('\n\n--- Testing POST /publication/sections ---');
  const createRes = await fetch(`${baseUrl}/publication/sections`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'User-Agent': 'substack-client-diagnostic/0.1',
    },
    body: JSON.stringify({ name: 'Diagnostic Test Section', description: 'Safe to delete' }),
  });
  console.log(`  Status: ${createRes.status}`);
  const createText = await createRes.text();
  console.log(`  Response: ${createText.slice(0, 1000)}`);

  // If created, try to delete it
  if (createRes.ok && createText) {
    try {
      const created = JSON.parse(createText);
      const createdId = created.id;
      console.log(`  Created ID: ${createdId} (type: ${typeof createdId})`);

      // Try DELETE
      console.log(`\n--- Testing DELETE /publication/sections/${createdId} ---`);
      const delRes = await fetch(`${baseUrl}/publication/sections/${createdId}`, {
        method: 'DELETE',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
          'User-Agent': 'substack-client-diagnostic/0.1',
        },
      });
      console.log(`  Status: ${delRes.status}`);
      const delText = await delRes.text();
      if (delText) console.log(`  Response: ${delText.slice(0, 300)}`);
    } catch (e) {
      console.log(`  Parse error: ${e}`);
    }
  }

  console.log('\n\n✅ Done');
}

main().catch(console.error);
