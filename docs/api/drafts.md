# Drafts CRUD

## Overview

Drafts are created and managed through a two-step process: POST creates a shell draft, PUT adds the body content. The body uses ProseMirror JSON format (stringified).

## Base URL

`https://{publication}.substack.com/api/v1/`

## Endpoints

### List Drafts

**Endpoint:** `GET /api/v1/drafts?limit={n}`

**Response:** `200 OK`
```json
{
  "posts": [
    {
      "id": 201148996,
      "uuid": "a2edcfd8-86a2-460f-9732-5c8062bef286",
      "publication_id": 9425834,
      "type": "newsletter",
      "post_date": null,
      "email_sent_at": null,
      "is_published": false,
      "title": null,
      "draft_title": "How to use the Substack editor",
      "draft_updated_at": "2026-06-08T13:46:57.296Z",
      "audience": "everyone",
      "slug": null,
      "should_send_email": null,
      "write_comment_permissions": "only_paid",
      "section_id": null,
      "cover_image": null,
      "publishedBylines": [
        {
          "id": 114676504,
          "name": "Nic Vane",
          "handle": "nicvane",
          "photo_url": "https://..."
        }
      ],
      "reaction_count": 0,
      "comment_count": 0
    }
  ],
  "hasMore": false,
  "nextCursor": null
}
```

**Pagination:** Cursor-based. If `hasMore` is true, pass `nextCursor` as query param.

---

### Create Draft (Step 1: Shell)

**Endpoint:** `POST /api/v1/drafts/`

**Request Body:**
```json
{
  "draft_title": "My Post Title",
  "draft_subtitle": "Optional subtitle",
  "draft_bylines": [{"id": 114676504, "is_guest": false}],
  "type": "newsletter"
}
```

**Required Fields:**
- `draft_bylines` — **REQUIRED** even for single-author publications. Array of `{id, is_guest}` objects.
- `type` — `"newsletter"` for standard posts

**Optional Fields:**
- `draft_title` — Post title
- `draft_subtitle` — Post subtitle

**Response:** `200 OK`
```json
{
  "id": 209908892,
  "uuid": "1cc47b8a-9e77-457f-9be9-e7bf8d186e99",
  "type": "newsletter",
  "draft_title": "My Post Title",
  "draft_subtitle": "Optional subtitle",
  "publication_id": 9425834,
  "audience": "only_paid",
  "word_count": 0,
  "write_comment_permissions": "only_paid",
  "should_send_email": true,
  "draft_body": null,
  "draft_section_id": null,
  "is_published": false,
  "post_date": null,
  "draft_created_at": "2026-08-05T10:46:17.975Z",
  "draft_updated_at": "2026-08-05T10:46:17.975Z",
  "editor_v2": false
}
```

**Error — Missing bylines:**
```json
{
  "errors": [
    {
      "location": "body",
      "param": "draft_bylines",
      "msg": "Invalid value"
    }
  ]
}
```

---

### Update Draft (Step 2: Add Body + Settings)

**Endpoint:** `PUT /api/v1/drafts/{id}/`

**Request Body:**
```json
{
  "draft_body": "{\"type\":\"doc\",\"content\":[...]}",
  "draft_bylines": [{"id": 114676504, "is_guest": false}],
  "draft_title": "Updated Title",
  "draft_subtitle": "Updated Subtitle",
  "draft_section_id": 403948,
  "section_chosen": true,
  "audience": "only_paid",
  "write_comment_permissions": "only_paid",
  "should_send_email": true,
  "cover_image": null,
  "detect_language": true,
  "hide_from_feed": false,
  "teaser_post_eligible": true,
  "meter_type": "none",
  "last_updated_at": "2026-08-05T10:47:26.501Z"
}
```

**Required Fields:**
- `draft_bylines` — **REQUIRED** on every PUT, even if unchanged

**Important Fields:**
- `draft_body` — Stringified ProseMirror JSON document (see ProseMirror section below)
- `draft_section_id` — Numeric section ID (required for publishing if publication has sections)
- `section_chosen` — Set to `true` to acknowledge section selection
- `audience` — `"everyone"` | `"only_paid"` | `"founding"`
- `last_updated_at` — Timestamp for optimistic locking (from previous GET/PUT response)

**Response:** `200 OK` — Returns the full updated draft object (same shape as GET).

**Optimistic Locking:**
- If `last_updated_at` is provided and doesn't match the server's value, returns `409 Conflict`:
  ```json
  {"error": "Post is out of date", "type": "single"}
  ```
- If `last_updated_at` is **omitted**, the PUT succeeds without locking (bypass).
- Best practice: always include `last_updated_at` from the previous GET/PUT response.

---

### Get Draft

**Endpoint:** `GET /api/v1/drafts/{id}`

**Response:** `200 OK` — Full draft object including `draft_body`, `postBylines`, `postSchedules`.

---

### Delete Draft

**Endpoint:** `DELETE /api/v1/drafts/{id}`

**Response:** `200 OK`
```json
{}
```

---

## ProseMirror Document Format

The `draft_body` field is a **stringified** ProseMirror document. The root node is always `type: "doc"`.

### Node Types

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "attrs": {"textAlign": null},
      "content": [{"type": "text", "text": "Hello world"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 2, "textAlign": null},
      "content": [{"type": "text", "text": "A heading"}]
    }
  ]
}
```

### Mark Types (inline formatting)

In the API responses (after editor save), marks use ProseMirror standard names:
- `strong` — Bold
- `em` — Italic
- `link` — Link (with attrs: `{href, target, rel, class}`)

**Note:** When the API *receives* content, it also accepts `bold` and `italic` as mark types and they work correctly. But the editor saves as `strong`/`em`.

### Known Node Types

| Node | Attrs | Notes |
|------|-------|-------|
| `paragraph` | `textAlign` | Standard paragraph |
| `heading` | `level`, `textAlign` | Heading h1-h6 |
| `bullet_list` | — | Unordered list (snake_case!) |
| `ordered_list` | — | Ordered list |
| `list_item` | — | List item (contains paragraphs) |
| `blockquote` | — | Blockquote |
| `captionedImage` | `src`, `title`, etc. | Image with caption (camelCase!) |
| `paywall` | — | Paywall boundary marker |
| `button` | `url`, `text`, `action`, `class` | CTA button |
| `horizontal_rule` | — | Horizontal divider |

### Paywall Node

Insert `{"type": "paywall"}` in the content array to mark where the paywall starts:

```json
{
  "type": "doc",
  "content": [
    {"type": "paragraph", "content": [{"type": "text", "text": "Free preview"}]},
    {"type": "paywall"},
    {"type": "paragraph", "content": [{"type": "text", "text": "Paid content"}]}
  ]
}
```

---

## Important Notes

- **Two-step creation is mandatory:** POST only creates the shell. Body MUST be added via PUT.
- **`draft_bylines` is always required:** Both on POST (create) and PUT (update).
- **`draft_body` must be stringified JSON:** Not a JSON object, but `JSON.stringify(doc)`.
- **`body` field is null for unpublished drafts:** Only populated after publishing.
- **`body_html` field does not exist for writes:** Must use `draft_body` with ProseMirror.
- **Mixed node naming:** `bullet_list` (snake_case) but `captionedImage` (camelCase).
- **Section may be required for publishing:** If the publication has sections configured, you must set `draft_section_id` before publishing, or the publish endpoint returns `400: "Please choose a section."`.
