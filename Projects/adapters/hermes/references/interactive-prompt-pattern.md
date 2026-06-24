# Interactive Prompt Pattern

## promptYesNo() — readline-based y/n prompt

Defined in `cli/lib/modes.mjs`. Uses Node.js readline to ask the user a yes/no question.

```javascript
import { promptYesNo } from './modes.mjs';
const answer = await promptYesNo('Continue?');  // true, false, or null (non-TTY)
```

## Return values

| Context | Returns |
|---------|---------|
| User types "y" or "yes" | `true` |
| User types anything else | `false` |
| stdin is not a TTY (CI, tests) | `null` |

## Two-flag design (autoPrompt + confirmGates)

Copilot mode has two independent config flags that control the auto-prompt behavior:

| Flag | Effect when true | Effect when false |
|------|-----------------|-------------------|
| `copilot.autoPrompt` | Show the "Advance to X? (y/n)" prompt after gate passes | Skip prompt entirely |
| `copilot.confirmGates` | Wait for y/n answer before advancing | Auto-advance without waiting |

Both default to `true` when `set-mode copilot` is called. They are independent — `autoPrompt: false` suppresses the prompt regardless of `confirmGates`.

## Wiring checklist

When adding a new interactive prompt to a command:

1. Import `promptYesNo` and the relevant flag check from `modes.mjs`
2. Guard with the flag check: `if (shouldAutoPrompt(dir)) { ... }`
3. Call `promptYesNo()` only within the guard
4. Handle all three return values (true/false/null)
5. The prompt MUST be skippable in non-TTY contexts
