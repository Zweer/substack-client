# Sections

## Overview

Sections are categories/newsletters within a publication. Each section has its own feed, slug, and subscriber settings. Posts are assigned to sections via `draft_section_id`.

Substack uses a **dual system**: numeric section IDs (legacy, used for post assignment) and UUID-based post-tags (newer, used for tagging/filtering).

## Base URL

`https://{publication}.substack.com/api/v1/`

## Endpoints

### List Sections

**Endpoint:** `GET /api/v1/publication/sections`

**Response:** `200 OK`
```json
[
  {
    "id": 403948,
    "created_at": "2026-06-09T10:37:13.011Z",
    "updated_at": "2026-06-11T09:35:34.438Z",
    "publication_id": 9425834,
    "name": "Ale",
    "description": "Two people. Fifteen years. One weekend that changes everything.",
    "slug": "ale",
    "is_podcast": false,
    "is_live": true,
    "is_default_on": true,
    "sibling_rank": 0,
    "port_status": "success",
    "logo_url": "https://substack-post-media.s3.amazonaws.com/public/images/...",
    "hide_from_navbar": false,
    "email_from_name": "",
    "hide_posts_from_pub_listings": false,
    "email_banner_url": null,
    "cover_photo_url": null,
    "hide_intro_title": false,
    "hide_intro_subtitle": false,
    "ignore_publication_email_settings": false,
    "custom_config": {}
  }
]
```

---

### Create Section

**Endpoint:** `POST /api/v1/publication/sections`

**Request Body:**
```json
{
  "name": "New Section Name",
  "description": "Description of the section"
}
```

**Response:** `200 OK`
```json
{
  "section": {
    "name": "New Section Name",
    "description": "Description of the section",
    "is_podcast": false,
    "hide_from_navbar": false,
    "hide_posts_from_pub_listings": false,
    "hide_intro_title": false,
    "hide_intro_subtitle": false,
    "is_default_on": true,
    "slug": "new-section-name",
    "publication_id": 9425834,
    "sibling_rank": 5,
    "is_live": false,
    "port_status": "porting",
    "id": 438406
  }
}
```

**Notes:**
- `slug` is auto-generated from `name`
- `is_live` starts as `false`, becomes `true` after `port_status` becomes `"success"`
- `port_status` transitions: `"porting"` → `"success"`
- Section is immediately usable for assigning posts even while `port_status` is `"porting"`

---

### Update Section

**Endpoint:** `PATCH /api/v1/publication/sections/{id}`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Response:** `200 OK`
```json
{
  "section": {
    "id": 438406,
    "created_at": "2026-08-05T10:49:35.502Z",
    "updated_at": "2026-08-05T10:49:40.851Z",
    "publication_id": 9425834,
    "name": "Updated Name",
    "description": "Updated description",
    "slug": "new-section-name",
    "is_podcast": false,
    "is_live": true,
    "is_default_on": true,
    "sibling_rank": 5,
    "port_status": "success",
    "logo_url": null,
    "hide_from_navbar": false,
    "email_from_name": null,
    "hide_posts_from_pub_listings": false,
    "email_banner_url": null,
    "cover_photo_url": null,
    "hide_intro_title": false,
    "hide_intro_subtitle": false,
    "ignore_publication_email_settings": false,
    "custom_config": {},
    "podcastSettings": null,
    "pageTheme": null
  }
}
```

**Notes:**
- `slug` does NOT change when name is updated
- Method is `PATCH`, not `PUT`

---

### Delete Section

**Endpoint:** `DELETE /api/v1/publication/sections/{id}`

**Response:** `200 OK`
```
1
```

Returns `1` (plain number) on success.

---

## Assigning Posts to Sections

Posts are assigned to sections via the draft PUT endpoint:

```json
PUT /api/v1/drafts/{id}/

{
  "draft_section_id": 403948,
  "section_chosen": true,
  "draft_bylines": [{"id": 114676504, "is_guest": false}]
}
```

- `draft_section_id` — Numeric section ID
- `section_chosen` — Set to `true` to acknowledge the selection

---

## Dual System: Sections vs Post-Tags

Substack maintains two parallel categorization systems:

### Sections (Numeric IDs)
- Used for `draft_section_id` on posts
- Each post belongs to exactly ONE section
- Sections have their own feed/page (`/s/{slug}`)
- Listed via `GET /api/v1/publication/sections`

### Post-Tags (UUID IDs)
- Used for additional tagging/filtering
- Posts can have MULTIPLE tags
- Listed via `GET /api/v1/publication/post-tag`
- Assigned per-post via `POST /api/v1/post/{id}/tag/{tag_id}`
- Listed per-post via `GET /api/v1/post/{id}/tag`
- Removed via `DELETE /api/v1/post/{id}/tag/{tag_id}`

**Assign Tag to Post:**
```
POST /api/v1/post/{post_id}/tag/{tag_id}
```

Response: `200 OK`
```json
{
  "id": "c92eb033-b1a1-43e5-8f97-b6bf54fcd0dc",
  "publication_id": 9425834,
  "post_id": 209912193,
  "post_tag_id": "c197b803-ecc6-46c8-93ad-2a18c5ed3876"
}
```

**List Tags on Post:**
```
GET /api/v1/post/{post_id}/tag
```

Response: `200 OK`
```json
[
  {
    "id": "c92eb033-b1a1-43e5-8f97-b6bf54fcd0dc",
    "publication_id": 9425834,
    "post_id": 209912193,
    "post_tag_id": "c197b803-ecc6-46c8-93ad-2a18c5ed3876"
  }
]
```

**Remove Tag from Post:**
```
DELETE /api/v1/post/{post_id}/tag/{tag_id}
```

Response: `200 OK` — `{}`

**Post-Tag List Response:**
```json
[
  {
    "id": "c197b803-ecc6-46c8-93ad-2a18c5ed3876",
    "publication_id": 9425834,
    "name": "Ale",
    "slug": "ale",
    "hidden": false
  },
  {
    "id": "f4e41f07-07c1-4dc3-a28d-f212cc870023",
    "publication_id": 9425834,
    "name": "Bea",
    "slug": "bea",
    "hidden": false
  }
]
```

**Notes:**
- Some tags mirror section names (e.g., "Ale" exists as both a section and a tag)
- Tags use UUIDs; sections use sequential numeric IDs
- The publish dialog shows sections in a dropdown, tags in a separate combobox

---

## Important Notes

- **Section is required before publishing** if the publication has sections configured
- **Sections are publication-wide** — they cannot be per-user
- **`sibling_rank`** determines the display order in the navigation bar
- **`is_default_on`** — Whether new subscribers auto-subscribe to this section's emails
- **Deleting a section** does not delete posts within it (they become unassigned)
