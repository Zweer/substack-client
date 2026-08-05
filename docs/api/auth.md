# Authentication

## Overview

Substack uses an Express session cookie (`substack.sid`) for all authenticated API requests. The cookie is a signed session ID (format: `s%3A{session_id}.{signature}`), not a JWT.

There is also a secondary cookie `substack.lli` which is a JWT with audience `likely-logged-in` — this is used for UI personalization, NOT for API authentication.

## Base URL

All authenticated API calls use the publication subdomain:
```
https://{publication}.substack.com/api/v1/...
```

## Authentication Method

### Cookie-Based Auth

Every API request requires the `substack.sid` cookie to be sent automatically (via browser credentials or explicit `Cookie` header).

**Cookie Details:**
| Field | Value |
|-------|-------|
| Name | `substack.sid` |
| Domain | `.substack.com` |
| Path | `/` |
| Format | `s%3A{session_id}.{hmac_signature}` (URL-encoded Express signed cookie) |
| HttpOnly | Yes |
| Secure | Yes |

**Additional Cookies (set by Cloudflare/AWS):**
- `cf_clearance` — Cloudflare challenge token
- `__cf_bm` — Cloudflare bot management
- `AWSALBTG` / `AWSALBTGCORS` — AWS ALB sticky session (per-subdomain)

### Request Headers

Authenticated requests need no special headers beyond the cookie. The browser automatically sends:
```
Cookie: substack.sid=s%3A...
```

For programmatic access:
```http
GET /api/v1/drafts HTTP/1.1
Host: {publication}.substack.com
Cookie: substack.sid=s%3AXyLXFMhuazTqoMoBW7-EowsufqkGZi0m.N2M%2BZ3gM7uKQxHwwrM5uqFAoy4CrrjHOooMguG8YbWk
```

For write operations, also include:
```
Content-Type: application/json
```

## Session Validation

### Check if session is valid

**Endpoint:** `GET /api/v1/publication`

This returns publication settings if authenticated, or redirects/403 if not.

**Simpler check:** `GET /api/v1/post_management/counts?query=`
- Returns `200` with JSON if authenticated
- Returns `403` with body `"Not authorized"` if not

### Get current user info

**Endpoint:** `GET /api/v1/publication_user`

Returns the current user's relationship to the publication, including role, profile info, and subscriptions.

**Response:** `200 OK`
```json
{
  "pub_users": [{
    "id": 9669581,
    "publication_id": 9425834,
    "user_id": 114676504,
    "role": "admin",
    "is_primary": true,
    "public": true,
    "user": {
      "id": 114676504,
      "name": "Nic Vane",
      "handle": "nicvane",
      "email": "user@example.com",
      "photo_url": "https://...",
      "bio": "...",
      "created_at": "2022-12-12T18:20:04.457Z"
    }
  }]
}
```

## Error Responses

### 403 — Not Authorized

Returned when the cookie is missing, expired, or invalid.

```
HTTP/1.1 403
Content-Type: text/html; charset=utf-8
Content-Length: 14

Not authorized
```

**Response body:** `"Not authorized"` (plain text, not JSON)

### Redirect to Login

For page navigation (non-API), Substack redirects to:
```
https://substack.com/sign-in?redirect=%2F{path}&for_pub={subdomain}&error=This%20page%20is%20private...
```

## Important Notes

- The `substack.sid` cookie is set on `.substack.com` domain and works across all subdomains
- API endpoint `/api/v1/user/me` exists but returns `403` on publication subdomains — use `/api/v1/publication_user` instead
- Cloudflare may require a `cf_clearance` cookie on first access (challenge page)
- The session cookie format is Express's `express-session` signed cookie
- No CSRF tokens are required for API calls
- No Bearer/Authorization header is used

## Login

Login via `POST /api/v1/login` triggers a captcha from non-browser contexts. The recommended approach is manual browser login + cookie extraction.

## Cookie Lifetime

The exact session TTL is not documented in responses. Based on observation:
- Sessions last at least several days
- The cookie does not include an explicit `Expires` header (session cookie)
- The `substack.lli` JWT has a ~30 day expiry, but this is NOT the auth cookie

## Rate Limiting

Substack enforces rate limiting on API requests:

**Response:** `429 Too Many Requests`
```
HTTP/1.1 429
Content-Type: text/plain; charset=utf-8
Content-Length: 17

Too Many Requests
```

**Behavior:**
- No `Retry-After` header is returned
- No `X-RateLimit-*` headers are present
- Threshold: approximately 25-30 concurrent requests to the same endpoint
- Body: plain text `"Too Many Requests"` (not JSON)
- Recovery: wait a few seconds and retry

**Strategy for clients:**
- Use exponential backoff since no `Retry-After` is provided
- Start with 1-2 second delay, double on each retry
- Limit concurrent requests (max ~10 parallel)
