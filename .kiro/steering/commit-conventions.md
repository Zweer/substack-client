# Commit Conventions

**IMPORTANT**: The agent NEVER commits, pushes, or creates tags. The developer handles all git operations manually. At the end of each task, suggest a commit message.

## Format

Conventional commits with gitmoji as text codes (not emoji):

```
type(scope): :emoji_code: short description

Detailed explanation of what changed and why.
```

## Types

- `feat` — New feature (`:sparkles:`)
- `fix` — Bug fix (`:bug:`)
- `perf` — Performance improvement (`:zap:`)
- `docs` — Documentation (`:memo:`)
- `chore` — Maintenance tasks (`:wrench:`, `:arrow_up:`, `:bookmark:`)
- `refactor` — Code refactoring (`:recycle:`)
- `test` — Tests (`:white_check_mark:`)
- `style` — Code formatting (`:art:`)
- `ci` — CI/CD changes (`:construction_worker:`)
- `build` — Build system (`:hammer:`)

## Scope

Use the module or area affected:
- `client` — Main SubstackClient class
- `drafts` — Draft CRUD operations
- `publish` — Publish/schedule/unpublish
- `sections` — Section CRUD
- `images` — Image upload
- `notes` — Notes operations
- `transform` — Markdown → ProseMirror
- `types` — Type definitions
- `http` — HTTP client internals

Scope is optional for cross-cutting changes.

## Gitmoji

**Always use text codes** (`:sparkles:`), **never actual emoji** (✨).

## Body

**Always include a detailed body** explaining:
1. What was changed
2. Why it was changed
3. Any important context or side effects

## Examples

```
feat(drafts): :sparkles: implement two-step draft creation

Create draft via POST /api/v1/drafts (shell only),
then PUT /api/v1/drafts/:id to add ProseMirror body.
Handles byline injection automatically.
```

```
docs(api): :memo: document drafts CRUD endpoints

Reverse-engineered from Substack dashboard via Playwright:
- POST /api/v1/drafts (create shell)
- PUT /api/v1/drafts/:id (add body, settings)
- GET /api/v1/drafts (list)
- DELETE /api/v1/drafts/:id
```

```
fix(http): :bug: handle rate limit with retry-after header

Substack returns 429 with Retry-After header in seconds.
Previously we used fixed backoff; now we respect the header value.
```
