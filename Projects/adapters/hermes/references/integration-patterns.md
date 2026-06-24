# Tool Integration Patterns

Found during dev-harness testing with real tools (June 2026).

## OpenProject

### Auth
- URL: `http://localhost:8080`
- Auth: `apikey:{API_KEY}` encoded as Basic auth
- API key in `~/ops/Secrets/infrastructure/openproject-api.env`

### Work Package CRUD
- **Create:** POST `/api/v3/work_packages` with `_links.project.href`, `_links.type.href`, `_links.status.href`, `subject`, `description.raw`
- **Update:** PATCH `/api/v3/work_packages/{id}` — requires `lockVersion` from current WP state (fetch first)
- **Delete:** DELETE `/api/v3/work_packages/{id}` — returns 204 on success

### Key: Always Use a Real Project
- Default "Demo project" (id=1) exists but is noisy with conference demo content
- Always create a dedicated project (POST `/api/v3/projects`) for real work
- Projects need: `identifier` (URL-safe slug), `name`, `description.raw`, `active=true`

### Statuses
- Status IDs vary by installation. Use the API to enumerate: GET `/api/v3/statuses`
- Common: 1=New, 2=In Progress, 3=... (enumerate before assuming)

## GitHub

### Auth
- `gh auth status` checks if CLI is authenticated
- Falls back to `GITHUB_TOKEN` env var or `~/.git-credentials`

### Common Patterns
- **Create issue:** `gh issue create --repo owner/repo --title "..." --body "..." --label "label"`
- **PR status:** `gh pr view N --repo owner/repo --json state,mergeable,reviews,statusCheckRollup`
- **CI checks:** Available via `statusCheckRollup` JSON field

### Offline Handling
- Always check `gh auth status` before calling GitHub — if unavailable, skip gracefully
- GitHub issues are optional during development; OpenProject is the primary tracker

## Zulip

### Auth
- URL: `https://localhost:8081`
- Bot email + API key in `~/ops/Secrets/infrastructure/zulip-api.env`
- Uses self-signed SSL — Python requires `ssl._create_unverified_context()` or `CERT_NONE`

### Communication Pattern
- Zulip is a **fallback** — use OpenProject comments as primary human-in-loop channel
- Only use Zulip when OpenProject is unavailable or human hasn't responded to OP comments
- Stream+topic structure maps to project+phase

## Obsidian / Ops Vault

### Dual-Path Model
- **Windows** (`/mnt/c/Users/bakrb/ObsidianVault/`) is authoring copy — edit here for content
- **WSL** (`~/ops/`) is git mirror — use only for deployment, cron, git operations
- For dev-harness artifacts, write to `~/ops/Areas/<area>/<project>/` — this maps to Obsidian vault

### File Conventions
- Specs: `spec.md` in `.hermes/harness/` (code-adjacent) AND `~/ops/Areas/<area>/<project>/spec.md` (Obsidian)
- Decision logs: `decisions.md` in Obsidian area
- Plan: `plan.json` in `.hermes/harness/` (machine-readable) with optional `plan.md` in Obsidian (human-readable)
