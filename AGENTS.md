# AGENTS.md — substack-client

Universal steering file for AI agents working on this project.

## Project Identity

**substack-client** is a TypeScript library that wraps Substack's internal API for publishing, scheduling, and managing posts programmatically. No official Substack API exists for writing — this library reverse-engineers the internal endpoints.

The library covers: drafts CRUD, publish/schedule/unpublish, sections, images, notes, markdown-to-ProseMirror transform, and read operations.

## Stack

- **Language:** TypeScript (strict mode, ES modules)
- **Runtime:** Node.js 22+
- **HTTP:** Native fetch (async/await)
- **Testing:** Vitest
- **Build:** tsdown
- **Lint/Format:** Biome
- **Package:** `@zweer/substack-client` (npm)

## Agent Architecture

This project uses two specialized Kiro agents:

### `rev-eng` — Reverse Engineering Agent
- **Purpose:** Discover Substack's internal API by navigating the web UI with Playwright
- **Input:** Substack credentials (`.env`)
- **Output:** API documentation in `docs/api/*.md`
- **Tools:** Playwright MCP (browser automation + network interception)

### `dev` — Development Agent
- **Purpose:** Implement the TypeScript library from the API docs
- **Input:** `docs/api/*.md` (produced by rev-eng)
- **Output:** `lib/`, `test/`, types, client code

### Workflow

```
rev-eng (Playwright) → docs/api/*.md → dev (implementation) → lib/ + test/
```

1. `rev-eng` navigates Substack, captures network traffic, documents every endpoint
2. `dev` reads the docs and implements type-safe wrappers

## Documentation Structure

```
docs/
├── api/               # Reverse-engineered API reference (rev-eng output)
│   ├── auth.md
│   ├── drafts.md
│   ├── publish.md
│   ├── sections.md
│   ├── images.md
│   ├── notes.md
│   └── posts.md
├── conventions/       # Code style, tooling, testing, commit rules
├── workflows/         # Cognitive modes (plan-product, plan-eng, code-review, ship-prep)
└── specs/             # Feature specs (requirements → design → tasks → testlist)
```

## Kiro Configuration

```
.kiro/
├── agents/
│   ├── rev-eng.json   # Agent definition (Playwright MCP, write to docs/api/)
│   └── dev.json       # Agent definition (full dev tools, write to lib/test/)
├── prompts/
│   ├── rev-eng.md     # Detailed instructions for API discovery
│   └── dev.md         # Detailed instructions for implementation
└── steering/
    ├── interaction.md
    ├── code-style.md
    ├── build-tooling.md
    └── commit-conventions.md
```

## Conventions (Summary)

Full details in `.kiro/steering/`. Key rules:

- TypeScript strict, no `any`, explicit return types on exports
- ES modules with `.js` extensions in imports
- `async/await` everywhere, native `fetch`
- Biome for lint + format (not ESLint/Prettier)
- Vitest for tests (AAA pattern)
- Conventional commits + gitmoji (text codes, not emoji)

## Interaction Rules

### Language
- **Conversation:** Italian
- **Code, comments, commits, docs:** English

### Git
- **NEVER commit, push, or create tags** — the developer handles all git operations
- Prepare changes and suggest a commit message
- The developer reviews and commits manually

### Interview Before Implementing
For ambiguous or complex requests, ask clarifying questions BEFORE writing code. Skip for clear, well-defined tasks.

### Plan Before Implementing
For multi-step tasks (new features, refactors, architecture changes):
1. Write a short numbered plan first
2. Wait for approval before implementing
3. Adapt the plan if requirements change mid-execution

Skip planning for single-file fixes, small bug fixes, or simple questions.

### Workflow Triggers

| Trigger | Mode | When |
|---|---|---|
| `plan product` | Product Owner | Starting a feature, vague requirements |
| `plan eng` | Tech Lead | After product direction is set, before implementing |
| `code review` | Paranoid Reviewer | After implementation, before committing |
| `ship prep` | Release Engineer | Final checklist before commit |

Details for each mode in `docs/workflows/`.
