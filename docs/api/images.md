# Images

## Overview

Substack uses a JSON-based image upload (NOT multipart form). Images are sent as base64 data URIs in a JSON body, and returned as S3 CDN URLs.

## Base URL

`https://{publication}.substack.com/api/v1/`

## Endpoints

### Upload Image

**Endpoint:** `POST /api/v1/image`

**Request Headers:**
```
Content-Type: application/json
Cookie: substack.sid=...
```

**Request Body:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY..."
}
```

**Fields:**
- `image` — Full data URI string: `data:{mime_type};base64,{base64_encoded_data}`

**Supported MIME types:**
- `image/png`
- `image/jpeg`
- `image/gif`
- `image/webp`

**Response:** `200 OK`
```json
{
  "id": 319287167,
  "url": "https://substack-post-media.s3.amazonaws.com/public/images/096d59ed-62d7-41a3-afb7-2be507431019_1x1.png",
  "contentType": "image/png",
  "bytes": 70,
  "imageWidth": 1,
  "imageHeight": 1
}
```

**Response Fields:**
- `id` — Numeric image ID
- `url` — CDN URL for the uploaded image (permanent, publicly accessible)
- `contentType` — MIME type
- `bytes` — File size in bytes
- `imageWidth` — Image width in pixels
- `imageHeight` — Image height in pixels

---

## Embedding Images in ProseMirror Body

Once uploaded, images are embedded in the ProseMirror document using the `captionedImage` node type:

```json
{
  "type": "captionedImage",
  "attrs": {
    "src": "https://substack-post-media.s3.amazonaws.com/public/images/096d59ed-62d7-41a3-afb7-2be507431019_1x1.png",
    "title": "",
    "fullscreen": false,
    "imageSize": "normal",
    "height": null,
    "width": null,
    "resizeWidth": null,
    "bytes": 70,
    "alt": "",
    "caption": "",
    "href": null,
    "belowTheFold": false,
    "topImage": false,
    "internalRedirect": null,
    "isEditorRecent": true
  }
}
```

**Attrs:**
- `src` — The CDN URL from the upload response
- `title` — Image title attribute
- `fullscreen` — Whether the image should be displayed full-width
- `imageSize` — `"normal"` | `"small"` | `"full"`
- `bytes` — File size (same as upload response)
- `alt` — Alt text for accessibility
- `caption` — Image caption text
- `href` — Optional link URL when image is clicked

---

## Important Notes

- **Upload format is JSON with base64**, NOT multipart form-data
- **The data URI must include the full prefix:** `data:image/png;base64,...`
- **Images are permanent** — once uploaded, there's no known delete endpoint
- **CDN URL pattern:** `https://substack-post-media.s3.amazonaws.com/public/images/{uuid}_{dimensions}.{ext}`
- **Max file size:** Observed limit is 64MB (`max_image_upload_mb` in site config)
- **Node type is camelCase:** `captionedImage`, not `captioned_image` (unlike `bullet_list`)
