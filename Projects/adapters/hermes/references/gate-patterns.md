# Gate Patterns — Lessons from Testing

## Subprocess PYTHONPATH Handling

Gate checkers run as subprocesses — they do NOT inherit the parent agent's
PYTHONPATH. This causes two failures:

- `python3 -m pytest` finds zero tests because `src/` is not on sys.path
- `ruff` and other tools may not find project-local configurations

**Pattern (see gates.py `_run_env`):**
```python
def _run_env(project_dir: str) -> dict[str, str]:
    env = os.environ.copy()
    src = Path(project_dir).resolve() / "src"
    if src.is_dir():
        env["PYTHONPATH"] = str(src)
    return env
```

Always pass `env=_run_env(project_dir)` to subprocess.run in gate functions.

## Ruff Exit Code Handling

Ruff's output behaviour is counter-intuitive:

| Condition | exit code | stdout | stderr |
|-----------|-----------|--------|--------|
| 0 lint errors | 0 | `All checks passed!\n` | (empty) |
| N lint errors | 1 | `file.py:line:col: Error ...` | (empty) |
| Tool unavailable | — | (empty) | ModuleNotFoundError |

**Pattern:** Check `returncode != 0` first. Only parse stdout on error exit.
Do NOT check `if stdout.strip():` — that catches "All checks passed!" as an error.

```python
result = subprocess.run(["python3", "-m", "ruff", "check", "."], ...)
if result.returncode != 0 and result.stdout.strip():
    lines = [l for l in result.stdout.strip().split("\n")
             if l.strip() and not l.startswith("help:")]
    # report lines
# else: no errors
```

## Info vs Errors in Gate Functions

Original bug: gates appended informational items to the same list as errors,
then returned `len(reasons) == 0`. Since info like "2 test files found" or
"all 9 tests passed" was always present, gates always failed when they
should pass.

**Pattern:** Use two lists:
```python
info = []    # display-only, does not block gate
errors = []  # gate-blocking failures
# ... fill both ...
return len(errors) == 0, info + errors
```

The `harness.py` CLI prints all reasons but only the return boolean
determines pass/fail.

## Gate Contract

Every gate function has the same signature:
```python
def gate_<name>(project_dir: str) -> tuple[bool, list[str]]:
```

Returns:
- `(True, [info...])` — gate passed, info items for display
- `(False, [errors...])` — gate failed, error items explain why

Gates should return `False` immediately for catastrophic failures
(missing directory, file not found, zero test files). Use the
info/errors pattern for everything else.
