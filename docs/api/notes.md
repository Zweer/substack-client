# Notes

## Overview

Notes are short-form posts (similar to tweets) that appear in the Substack Notes feed. They use a ProseMirror JSON body (like posts) but are created via the `comment/feed` endpoint — Substack internally treats notes as "feed comments."

## Base URL

`https://{publication}.substack.com/api/v1/`

## Endpoints

### List Notes

**Endpoint:** `GET /api/v1/notes`

**Response:** `200 OK`
```json
{
  "items": [],
  "originalCursorTimestamp": "2026-08-05T11:04:52.471Z",
  "nextCursor": null
}
```

**Pagination:** Cursor-based. If items exist and there are more, `nextCursor` will be non-null.

**Fields:**
- `items` — Array of note objects
- `originalCursorTimestamp` — Server timestamp for the query
- `nextCursor` — Pagination cursor (pass as query param for next page)

---

### List Note Drafts

**Endpoint:** `GET /api/v1/feed/drafts?limit={n}`

**Response:** `200 OK`
```json
{
  "drafts": [],
  "hasMore": false,
  "nextCursor": null
}
```

---

### Create Note

**Endpoint:** `POST /api/v1/comment/feed`

**Request Headers:**
```
Content-Type: application/json
Cookie: substack.sid=...
```

**Request Body:**
```json
{
  "bodyJson": {
    "type": "doc",
    "attrs": {
      "schemaVersion": "v1",
      "title": null
    },
    "content": [
      {
        "type": "paragraph",
        "content": [
          {"type": "text", "text": "My note content here"}
        ]
      }
    ]
  },
  "replyMinimumRole": "everyone"
}
```

**Fields:**
- `bodyJson` — ProseMirror JSON document (NOT stringified — it's a JSON object, unlike `draft_body` for posts which is stringified)
- `bodyJson.attrs.schemaVersion` — Always `"v1"`
- `bodyJson.attrs.title` — `null` for regular notes
- `replyMinimumRole` — `"everyone"` | `"only_paid"` — who can reply to this note

**Response:** `200 OK` — Returns the created note object.

**⚠️ Cloudflare WAF Issue:**
This endpoint is protected by Cloudflare's WAF more aggressively than other endpoints. From headless browser contexts, it may return `403` with an HTML error page. This appears to be a bot-detection measure specific to this endpoint.

**Workaround:** The endpoint works from the UI when proper Cloudflare challenge tokens are present. For programmatic access, you may need to:
1. Ensure `cf_clearance` cookie is fresh
2. Use a non-headless browser context
3. Include proper `User-Agent` and Cloudflare headers

---

### Delete Note

**Endpoint:** `DELETE /api/v1/comment/{note_id}`

TODO: Not yet verified — requires a successfully created note to test deletion.

---

## ProseMirror Format Differences (Notes vs Posts)

| Aspect | Posts (`draft_body`) | Notes (`bodyJson`) |
|--------|---------------------|-------------------|
| Format | **Stringified** JSON string | **Raw** JSON object |
| Root attrs | None | `{schemaVersion: "v1", title: null}` |
| Endpoint | `PUT /api/v1/drafts/:id` | `POST /api/v1/comment/feed` |
| Node types | Same ProseMirror nodes | Same ProseMirror nodes |

---

## Important Notes

- **Notes use `comment/feed` endpoint** — internally they're treated as "feed comments"
- **`bodyJson` is a raw object**, NOT a stringified string (unlike `draft_body` for posts)
- **Notes have `schemaVersion: "v1"`** in the doc attrs
- **Cloudflare WAF may block programmatic POST** — this is the most protected write endpoint
- **Notes don't require sections** — they're publication-wide
- **Notes support images** — via the same `captionedImage` node type
- **Notes support polls** — via a poll-specific node type (TODO: document)
