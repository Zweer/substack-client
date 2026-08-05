# @zweer/substack-client

A TypeScript client for Substack's internal API. Publish, schedule, and manage posts programmatically.

**No official Substack API exists for publishing.** This library reverse-engineers the internal endpoints used by the Substack web editor to provide a clean, type-safe interface for automation.

## Install

```bash
npm install @zweer/substack-client
```

## Quick Start

```typescript
import { SubstackClient, paragraph, paywall, heading } from '@zweer/substack-client';

const client = new SubstackClient({
  publication: 'yourname.substack.com',
  sid: process.env.SUBSTACK_SID,
});

// Create a draft
const draft = await client.createDraft({
  title: 'Chapter 7: The Cab',
  subtitle: 'A story about arrivals',
  sectionId: 403948,
});

// Add body content (ProseMirror JSON)
const body = JSON.stringify({
  type: 'doc',
  content: [
    heading('The Cab', 1),
    paragraph('The driver said nothing...'),
    paywall(),
    paragraph('This content is for paid subscribers only.'),
  ],
});

await client.updateDraft(draft.id, {
  body,
  audience: 'only_paid',
});

// Publish immediately (without sending email)
await client.publish(draft.id, { send: false });
```

## Features

- **Draft CRUD** — Create, update, get, list, delete
- **Publish / Schedule / Unpublish** — Full publishing lifecycle
- **Sections** — List, create, update, delete
- **Post-Tags** — CRUD + assign/remove from posts
- **Images** — Upload to Substack CDN (base64 JSON)
- **Notes** — Create, list, delete (short-form posts)
- **Posts (Read)** — List published/scheduled, get by slug, counts
- **ProseMirror Nodes** — Type-safe builders for all node types
- **Markdown → ProseMirror** — Convert Markdown to Substack's editor format

## API

### Drafts

```typescript
// Two-step creation: POST creates shell, PUT adds body
const draft = await client.createDraft({ title: 'My Post', sectionId: 123 });
await client.updateDraft(draft.id, { body: proseMirrorJson, audience: 'only_paid' });

// Read
const fetched = await client.getDraft(draft.id);
const { drafts, total } = await client.listDrafts({ offset: 0, limit: 25 });

// Delete
await client.deleteDraft(draft.id);
```

### Publish & Schedule

```typescript
// Publish immediately
await client.publish(draft.id, { send: true });

// Schedule for future (uses /scheduled_release endpoint)
await client.schedule(draft.id, {
  date: '2026-09-01T09:00:00Z',
  audience: 'only_paid',
});

// Cancel scheduled publish
await client.unschedule(draft.id);

// Unpublish (return to draft)
await client.unpublish(draft.id);

// Multi-tier early access
await client.scheduledRelease(draft.id, {
  date: '2026-07-13T18:00:00Z',
  postAudience: 'founding',
  emailAudience: 'founding',
});
```

### Sections

```typescript
const sections = await client.listSections();

const section = await client.createSection({
  name: 'New Arc',
  description: 'A new story arc',
});

await client.updateSection(section.id, { name: 'Renamed Arc' });
await client.deleteSection(section.id);
```

### Post-Tags

```typescript
const tags = await client.listPostTags();
const tag = await client.createPostTag({ name: 'Fiction' });

await client.assignTagToPost(postId, tag.id);
await client.removeTagFromPost(postId, tag.id);

const tagIds = await client.listPostTagsForPost(postId);
await client.deletePostTag(tag.id);
```

### Images

```typescript
// Upload from file path
const result = await client.uploadImage('/path/to/image.jpg');
// result: { id, url, contentType, bytes, imageWidth, imageHeight }

// Upload from Buffer
const buffer = fs.readFileSync('photo.png');
const result = await client.uploadImage(buffer, 'image/png');

// Use in ProseMirror body
import { captionedImage } from '@zweer/substack-client';
const node = captionedImage(result.url, { alt: 'A photo', caption: 'My caption' });
```

### Notes

```typescript
const note = await client.createNote({ text: 'Hello from the API!' });
const notes = await client.listNotes();
await client.deleteNote(note.id);
```

### Posts (Read)

```typescript
const { posts, total } = await client.listPublishedPosts({ limit: 10 });
const scheduled = await client.listScheduledPosts();
const counts = await client.getPostCounts(); // { published, drafts, scheduled }
const post = await client.getPost('post-slug'); // full HTML body
```

### Markdown → ProseMirror

```typescript
import { markdownToProseMirror } from '@zweer/substack-client/transform';

const doc = markdownToProseMirror(`
# Heading

A paragraph with **bold** and *italic* text.

- Bullet one
- Bullet two

> A blockquote

![Alt text](https://example.com/image.jpg)
`);

// Use as draft body
await client.updateDraft(draft.id, { body: JSON.stringify(doc) });
```

### ProseMirror Node Builders

```typescript
import {
  paragraph, heading, blockquote, bulletList, orderedList,
  paywall, divider, button, captionedImage,
  text, bold, italic, link,
} from '@zweer/substack-client';

const body = JSON.stringify({
  type: 'doc',
  content: [
    heading('Chapter 1', 1),
    paragraph('Free preview for everyone.'),
    paragraph([
      text('Click '),
      text('here', [bold(), link('https://example.com')]),
      text(' for more.'),
    ]),
    paywall(),
    paragraph('Paid content below the paywall.'),
    blockquote('A memorable quote.'),
    bulletList(['First item', 'Second item']),
    orderedList(['Step one', 'Step two'], 1),
    divider(),
    button('Subscribe Now', 'https://example.com/subscribe'),
    captionedImage('https://cdn.example.com/img.jpg', {
      alt: 'Description',
      caption: 'Photo credit',
      imageSize: 'full',
    }),
  ],
});
```

## Authentication

Substack uses session cookies. The login endpoint requires captcha, so:

1. Log into Substack in your browser
2. Open DevTools → Application → Cookies
3. Copy the `substack.sid` value
4. Store it as an environment variable

```bash
export SUBSTACK_SID="s%3A..."
```

## Error Handling

```typescript
import {
  SubstackError,       // Base error (any API failure)
  SubstackAuthError,   // 401/403 — expired or invalid cookie
  SubstackNotFoundError, // 404
  SubstackRateLimitError, // 429 — includes retryAfter if available
} from '@zweer/substack-client';

try {
  await client.publish(draftId);
} catch (error) {
  if (error instanceof SubstackAuthError) {
    // Re-authenticate
  } else if (error instanceof SubstackRateLimitError) {
    // Wait and retry (client does this automatically up to maxRetries)
  }
}
```

## Configuration

```typescript
const client = new SubstackClient({
  publication: 'yourname.substack.com', // or full URL
  sid: process.env.SUBSTACK_SID,
  connectSid: process.env.SUBSTACK_CONNECT_SID, // optional
  timeout: 30_000,          // request timeout (default: 30s)
  maxRetries: 3,            // retry on 429/5xx (default: 3)
  minRequestInterval: 500,  // rate limit between requests (default: 500ms)
  debug: false,             // log debug info (default: false)
});
```

## Project Structure

```
lib/
├── index.ts            # Public barrel (re-exports)
├── client.ts           # SubstackClient class (facade)
├── http.ts             # Internal HTTP client (auth, retry, rate limiting)
├── drafts.ts           # Draft CRUD
├── publish.ts          # Publish, schedule, unpublish
├── sections.ts         # Section CRUD
├── posts.ts            # Published posts (read)
├── images.ts           # Image upload
├── notes.ts            # Notes CRUD
├── post-tags.ts        # Post-tag CRUD + assignment
├── nodes.ts            # ProseMirror node builders
├── errors.ts           # Typed error classes
├── types.ts            # All type definitions
└── transform/
    ├── index.ts        # Public barrel for ./transform subpath
    └── markdown.ts     # Markdown → ProseMirror JSON
```

## Substack API Quirks

This library handles these internally:

| Quirk | How We Handle It |
|-------|-----------------|
| Two-step draft creation | `createDraft()` + `updateDraft()` — can't set body on create |
| `draft_bylines` always required | Auto-resolved from existing drafts or publication profile |
| ProseMirror JSON body | Node builders + markdown transform provided |
| Mixed node naming (`bullet_list` vs `captionedImage`) | Correct names in all builders |
| Schedule uses separate endpoint | `schedule()` calls `/scheduled_release`, not `/publish` |
| Image upload is JSON + base64 | Handled transparently by `uploadImage()` |
| 429 rate limiting (no Retry-After) | Exponential backoff with jitter |
| Session cookie auth (no API keys) | Cookie injection via `sid` option |

## License

MIT
