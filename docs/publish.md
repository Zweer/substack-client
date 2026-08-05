# Publish, Schedule, Unpublish

## Overview

Publishing uses the same draft endpoint with different sub-paths. Scheduling uses a separate `scheduled_release` endpoint.

## Base URL

`https://{publication}.substack.com/api/v1/`

## Endpoints

### Publish Immediately

**Endpoint:** `POST /api/v1/drafts/{id}/publish`

**Request Body:**
```json
{
  "send": false
}
```

**Fields:**
- `send` — `true` to send email to subscribers, `false` to publish without email

**Prerequisites:**
- Draft must have `draft_section_id` set if the publication has sections configured
- Otherwise returns `400`:
  ```json
  {"error": "Please choose a section.", "type": "single"}
  ```

**Response:** `200 OK`
```json
{
  "type": "newsletter",
  "audience": "only_paid",
  "body": "{\"type\":\"doc\",\"content\":[...]}",
  "draft_body": "{\"type\":\"doc\",\"content\":[...]}",
  "draft_title": "RE Test Draft",
  "draft_subtitle": "Test subtitle",
  "draft_section_id": 403948,
  "id": 209908892,
  "is_published": true,
  "post_date": "2026-08-05T10:46:48.619Z",
  "updated_at": "2026-08-05T10:46:48.063Z",
  "should_send_email": false,
  "slug": "re-test-draft",
  "subtitle": "Test subtitle",
  "section_id": 403948,
  "title": "RE Test Draft",
  "uuid": "1cc47b8a-9e77-457f-9be9-e7bf8d186e99",
  "write_comment_permissions": "only_paid",
  "publication_id": 9425834,
  "has_explicit_paywall": false,
  "audienceSizeLimited": 1
}
```

**Key observations:**
- After publishing, both `body` and `draft_body` are populated (identical)
- `is_published` becomes `true`
- `post_date` is set to the publish timestamp
- `slug` is auto-generated from the title
- `title` and `subtitle` are populated from `draft_title`/`draft_subtitle`
- `email_sent_at` is set only when `send: true`

---

### Publish with Email

**Endpoint:** `POST /api/v1/drafts/{id}/publish`

**Request Body:**
```json
{
  "send": true
}
```

**Response:** Same as above, but with `email_sent_at` populated:
```json
{
  "email_sent_at": "2026-08-05T10:47:16.278Z",
  "should_send_email": true
}
```

**Warning:** Once `send: true` is used, the email is sent immediately. There is no undo for email delivery.

---

### Schedule for Future Date

**Endpoint:** `POST /api/v1/drafts/{id}/scheduled_release`

**Request Body:**
```json
{
  "trigger_at": "2026-08-06T10:48:00.000Z",
  "post_audience": "only_paid"
}
```

**Fields:**
- `trigger_at` — ISO 8601 timestamp for when to publish (UTC)
- `post_audience` — `"everyone"` | `"only_paid"` | `"founding"`

**Prerequisites:**
- Draft must exist and not be published
- Must have `draft_section_id` set (same as publish)
- The UI performs a PUT to save the draft body before scheduling
- The UI calls `GET /api/v1/drafts/{id}/prepublish?publish_date={date}` for validation before scheduling

**Response:** `200 OK` — Returns the updated draft object with schedule info.

**Prepublish Check (optional but recommended):**
```
GET /api/v1/drafts/{id}/prepublish?publish_date=2026-08-06T10%3A48%3A00.000Z
```

---

### Unschedule (Cancel Scheduled Publish)

**Endpoint:** `DELETE /api/v1/drafts/{id}/scheduled_release`

**Response:** `200 OK`
```json
[11890474]
```

Returns an array containing the ID(s) of the cancelled schedule(s).

---

### Unpublish

**Endpoint:** `POST /api/v1/drafts/{id}/unpublish`

**Request Body:** None required (empty body is fine)

**Response:** `200 OK` — Empty body

**Effects:**
- `is_published` becomes `false`
- `post_date` retains its original value
- `body` becomes `null` again
- Draft returns to draft state (appears in drafts list)

---

## Audience / Visibility

Set via `audience` field on PUT (draft update):

| Value | Description |
|-------|-------------|
| `"everyone"` | Visible to all, including non-subscribers |
| `"only_paid"` | Only paid subscribers can read full content |
| `"founding"` | Only founding-tier subscribers |

The audience can also be specified at schedule time via `post_audience`.

---

## Paywall Placement

The paywall is a **node in the ProseMirror document**, not a post-level setting:

```json
{
  "type": "doc",
  "content": [
    {"type": "paragraph", "content": [{"type": "text", "text": "Free preview content"}]},
    {"type": "paywall"},
    {"type": "paragraph", "content": [{"type": "text", "text": "Paid-only content"}]}
  ]
}
```

When `has_explicit_paywall` is `true` in the publish response, it means the body contains a `{"type": "paywall"}` node.

---

## Important Notes

- **Scheduling is NOT via the publish endpoint.** It uses a separate `scheduled_release` endpoint.
- **The publish endpoint does NOT accept `post_date` for scheduling.** If you pass `post_date` to `/publish`, it publishes immediately regardless.
- **Unpublish returns empty body** (not JSON `{}`).
- **Email cannot be unsent.** Once `send: true` publishes, the email is delivered permanently.
- **Section is required before publishing** if the publication has sections configured.
- **The UI auto-saves the draft** (PUT) before scheduling or publishing.
