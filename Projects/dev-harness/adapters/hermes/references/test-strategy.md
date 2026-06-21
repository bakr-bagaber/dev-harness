# Test Strategy

The harness distinguishes two levels of testing. Both must be written;
only Level 1 blocks a gate.

## Level 1: Unit / Smoke Tests (blocking)

- Verify function signatures, return structures, error handling paths
- Run without any real system (KiCad CLI, APIs, services)
- Must pass in the development environment (WSL, CI, anywhere)
- Examples: `jlcpcb_pcb_quotation(50,50,2,5)` returns `estimated_dollars > 0`
  without calling any API; `bom_comparator` correctly identifies changed items.

**Where:** `tests/test_*.py` — no special marker needed.
**Run:** `pytest tests/ -v -k "not kicad"`

## Level 2: Integration Tests (non-blocking but mandatory)

- Exercise the toolchain against real KiCad CLI, supplier APIs, or target services
- Must be skippable — use `@pytest.mark.skipif(not HAS_KICAD, ...)`
- Written against the real system where the user runs it (Windows via WSL interop)

**Where:** `tests/test_integration.py` with `pytestmark = pytest.mark.kicad`.
**Run:** `pytest tests/ -v -m kicad`

### Integration test checklist (KiCad-specific)
- [ ] `kicad-cli version` — CLI responds
- [ ] `kicad-cli project new` — creates project with .kicad_pro
- [ ] `kicad-cli pcb render` — renders PCB to PNG
- [ ] `kicad-cli pcb export gerbers` — produces Gerber files
- [ ] `kicad-cli pcb drc` — runs DRC, returns violations or pass
- [ ] `kicad-cli sch export bom` — exports BOM from schematic

### Handling missing dependencies
If KiCad CLI is not installed: write the tests, mark `@pytest.mark.skipif`,
and document what needs to be installed:

```
# Ubuntu/Debian
sudo apt install kicad            # includes kicad-cli
# Windows (from kicad.org/download)
Standard installer → kicad-cli.exe at C:\Program Files\KiCad\<ver>\bin\
# Verify:
kicad-cli version                 # or
cmd.exe /c "kicad-cli version"
```