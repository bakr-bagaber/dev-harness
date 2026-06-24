# Gate Design Patterns

## Problem

Deterministic gates must accept or reject a phase using only filesystem state and tool outputs — no LLM calls. This sounds simple but has traps.

## Core Pattern: Separate Errors from Info

Every gate returns `(passed: bool, reasons: list[str])`.
- `passed = False` only when there is a **blocker** — something that genuinely prevents advancing.
- `reasons` contains informational messages too (file counts, versions, pass confirmations).

**The trap:** If you use `return len(reasons) == 0`, any informational message falsely fails the gate. Always return `return len(errors) == 0, errors + info` where `errors` and `info` are separate lists.

```python
# WRONG — this fails if reasons has any content
return len(reasons) == 0, reasons

# RIGHT — only actual blockers gate progress
errors = []  # only actual failures
info = []    # display-only messages
# ... checks that add to errors or info ...
return len(errors) == 0, info + errors
```

## Tool Output Traps

### Ruff
- Ruff writes "All checks passed!" to **stdout** on success, not stderr.
- Error lines follow `file:line:col: ...` format.
- **Check:** Use `result.returncode != 0` to detect errors, not stdout content.

```python
if result.returncode != 0 and result.stdout.strip():
    lines = result.stdout.strip().split("\n")
    errors.extend(lines)
```

### Pytest
- Pytest passes/failures are in mixed stdout+stderr.
- **Extract:** Use `re.search(r"(\d+) passed")` for count, `re.search(r"(\d+) failed")` for failures.
- **Env:** Set `PYTHONPATH` when project uses `src/` layout — pytest subprocess doesn't inherit parent's PYTHONPATH.

### Git
- `git status --porcelain` returns empty string when clean.
- Uncommitted files are expected during active development — they are **info**, not errors, in ship gate.

## Subprocess Environment

Always propagate project-specific env vars:

```python
def _run_env(project_dir):
    env = os.environ.copy()
    src = Path(project_dir) / "src"
    if src.is_dir():
        env["PYTHONPATH"] = str(src)
    return env
```

## When to Skip

Some tools may not be installed (ruff, pytest). Handle gracefully:

```python
try:
    result = subprocess.run(..., timeout=60)
except (FileNotFoundError, TimeoutExpired):
    info.append("tool unavailable — gate skipped")
    return True, info  # soft pass
```
