# Command Implementation Patterns

Every `harness-dev` command module in `cli/commands/<name>.mjs` follows these conventions. New commands must replicate them exactly.

## 1. `--target` Flag Support

Every command reads `targetDir` from the `--target` flag, falling back to `process.cwd()`:

```javascript
const rawTarget = args.flags?.target;
const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
```

**History:** Commands `config`, `phase`, and `learn` all shipped without `--target` support initially. Each had to be patched. The arg parser stores `--target <path>` as `args.flags.target = "<path>"`. The type guard (`typeof === 'string'`) prevents `--target` without a value from passing boolean `true` to `resolve()`.

## 2. JSON Output Contract

Every code path (success, error, not-implemented) must emit the standard contract:

```javascript
// Success:
process.stdout.write(JSON.stringify({
  command: '<name>',
  status: 'ok',
  message: '...',
  // command-specific fields
}) + '\n');

// Errors: use die() or process.stderr.write
process.stderr.write(JSON.stringify({
  command: '<name>',
  status: 'error',
  message: 'error text',
}) + '\n');
```

**Never use `{error: true, message: ...}` for JSON errors** — this was the old pattern from `templates.mjs` that got standardized in T3 fixes. Always use `{command, status, message}`.

## 3. Human Output

Use checkmark (`✓`) for success, cross (`✗`) for errors:

```javascript
if (result.ok) {
  process.stdout.write(`✓ ${summary}\n`);
} else {
  process.stderr.write(`✗ ${error}\n`);
}
```

## 4. Exit Codes

| Exit | Constant | When |
|------|----------|------|
| 0 | `EXIT.SUCCESS` | Command completed |
| 1 | `EXIT.VALIDATION_FAILURE` | Gate failed, invalid transition |
| 2 | `EXIT.USAGE_ERROR` | Bad args, unknown command, missing flag |
| 3 | `EXIT.INTERNAL_ERROR` | CLI bug (crash, uncaught exception) |

Exit code 3 means "CLI bug, not user mistake." Never use 3 for user-facing errors.

## 5. Type Coercion for `config set`

Values are coerced: `"true"`/`"false"` → boolean, numeric strings → number, `"null"` → null, everything else → string. See `cli/commands/config.mjs` lines 79-85.

## 6. Command File Template

```javascript
import { resolve } from 'node:path';
import { CliError, EXIT, die } from '../lib/errors.mjs';

export default async function commandName(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();

  // validate, execute, produce output with --json and human paths
}
```
