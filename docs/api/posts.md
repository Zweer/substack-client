# Posts (Read Operations)

## Overview

Published posts are accessed via the `post_management` endpoints for admin/dashboard views, and via `post` endpoints for public reads. These are read-only endpoints — writing is done through the Drafts API.

## Base URL

`https://{publication}.substack.com/api/v1/`

## Endpoints

### List Published Posts (Admin)

**Endpoint:** `GET /api/v1/post_management/published?offset={n}&limit={n}&order_by=post_date&order_direction=desc`

**Query Parameters:**
- `offset` — Pagination offset (0-based)
- `limit` — Number of posts to return (max observed: 25)
- `order_by` — Sort field: `post_date`
- `order_direction` — `desc` (newest first) | `asc` (oldest first)

**Response:** `200 OK`
```json
{
  "posts": [
    {
      "id": 209908892,
      "uuid": "1cc47b8a-9e77-457f-9be9-e7bf8d186e99",
      "publication_id": 9425834,
      "type": "newsletter",
      "post_date": "2026-08-05T10:46:48.619Z",
      "email_sent_at": null,
      "is_published": true,
      "title": "RE Test Draft",
      "draft_title": "RE Test Draft",
      "draft_updated_at": "2026-08-05T10:46:43.573Z",
      "audience": "only_paid",
      "slug": "re-test-draft",
      "should_send_email": false,
      "write_comment_permissions": "only_paid",
      "section_id": 403948,
      "cover_image": null,
      "section_slug": "ale",
      "section_name": "Ale",
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
  "offset": 0,
  "limit": 10,
  "total": 1,
  "isCapped": false
}
```

**Pagination:** Offset-based. Use `offset` + `limit`. `total` gives the total count.

---

### List Scheduled Posts (Admin)

**Endpoint:** `GET /api/v1/post_management/scheduled?offset={n}&limit={n}&order_by=trigger_at&order_direction=asc`

**Response:** Same structure as published, but `order_by` uses `trigger_at`.

```json
{
  "posts": [],
  "offset": 0,
  "limit": 10,
  "total": 0,
  "isCapped": false
}
```

---

### Get Post Counts

**Endpoint:** `GET /api/v1/post_management/counts`

**Response:** `200 OK`
```json
{
  "published": 0,
  "publishedIsCapped": false,
  "drafts": 1,
  "draftsIsCapped": false,
  "scheduled": 0,
  "scheduledIsCapped": false
}
```

**Notes:**
- Quick way to check how many posts in each state
- Also useful as a session validation endpoint (returns 403 if not authorized)
- Accepts optional `?query=` param for filtered counts (search)

---

### Get Single Published Post

**Endpoint:** `GET /api/v1/post/{id}`

**Response:** `200 OK` — Full post object with body, metadata, stats.

**Error (draft/not published):** `404` — Returns HTML page, not JSON.

**Note:** This endpoint only works for published posts. Unpublished drafts return 404. Use `GET /api/v1/drafts/{id}` for draft access.
---

### List Drafts (Admin)

**Endpoint:** `GET /api/v1/post_management/drafts?offset={n}&limit={n}&order_by=draft_updated_at&order_direction=desc`

**Response:** Same pagination structure as published.

---

## Search / Filter

**Endpoint:** `GET /api/v1/post_management/published?offset=0&limit=25&order_by=post_date&order_direction=desc&query={search_term}`

Add `query` parameter to search published posts by title/content.

---

## Important Notes

- **Admin endpoints** (`/post_management/*`) require authentication and return dashboard-level data
- **Public post endpoint** (`/post/{id}`) returns full post content for published posts
- **Drafts are NOT accessible** via `/post/{id}` — use `/drafts/{id}` instead
- **Pagination is offset-based** for post_management endpoints (not cursor-based like drafts list)
- **`isCapped`** — indicates if the count is approximate (for very large publications)
- **Stats per post** are not included in list views — need separate endpoint
