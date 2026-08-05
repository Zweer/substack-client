# Substack API Documentation

Reverse-engineered API reference produced by the `rev-eng` agent via Playwright browser automation.

## Files

Each file documents one functional area:

| File | Area |
|------|------|
| `auth.md` | Login, session cookies, validation |
| `drafts.md` | Draft CRUD (two-step creation, ProseMirror body) |
| `publish.md` | Publish, schedule, unpublish, audience |
| `sections.md` | Section CRUD, assignment to posts |
| `images.md` | Image upload (base64 JSON format) |
| `notes.md` | Notes CRUD |
| `posts.md` | Published posts (read operations) |

## How It's Produced

The `rev-eng` agent:
1. Opens a Chromium browser via Playwright MCP
2. Logs into Substack with real credentials
3. Navigates the dashboard, performing each action via UI
4. Captures all network requests/responses
5. Documents endpoints with exact payloads, headers, and error responses
6. Cleans up all test data before ending

## Status

- [x] auth.md
- [x] drafts.md
- [x] publish.md
- [x] sections.md
- [x] images.md
- [ ] notes.md
- [ ] posts.md
