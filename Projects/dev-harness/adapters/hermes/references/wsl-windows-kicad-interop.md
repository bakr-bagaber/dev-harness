# WSL ↔ Windows KiCad CLI Interop

When KiCad is installed on Windows but the agent runs in WSL, testing requires careful path handling.

## Where to find KiCad on Windows from WSL

KiCad installs to `E:\KiCad\10.0\bin\kicad-cli.exe` (or C: drive). WSL mounts Windows drives at `/mnt/{drive}/`.

## Critical: Windows EXEs need Windows paths

kicad-cli.exe running inside WSL via `/mnt/e/KiCad/10.0/bin/kicad-cli.exe` **cannot** access WSL-style paths (like `/tmp/foo` or `/mnt/e/tmp/bar`). The Windows process sees `\\wsl.localhost\...` which fails.

Always pass Windows-native paths (e.g. `E:\tmp\test.kicad_pcb`) to kicad-cli.exe, not WSL paths (e.g. `/mnt/e/tmp/test.kicad_pcb`).

```python
def _win_path(wsl_path: Path) -> str:
    """Convert /mnt/e/foo to E:\\foo for Windows executables."""
    p = str(wsl_path.absolute())
    if p.startswith("/mnt/e/"):
        return "E:" + p[6:].replace("/", "\\")
    return p
```

## Env vars

| Env var | Purpose |
|---------|---------|
| `KICAD_CLI` | Backend reads this first |
| `KICAD_CLI_PATH` | Also checked (fallback) |
| Both | Point to the kicad-cli.exe absolute path |

## Backend detection order

The `find_kicad_cli()` function in `cli_backend.py` checks:
1. `KICAD_CLI_PATH` env var
2. `KICAD_CLI` env var
3. `/mnt/{e,c,d}/KiCad/{10.0,9.0,8.0}/bin/kicad-cli.exe` (WSL detection)
4. Standard platform paths (Program Files on Windows, /usr/bin on Linux, /Applications on macOS)

## KiCad 10.0 CLI subcommands

KiCad 10.0 removed `project new`. The available subcommands are:

| Subcommand | Operations |
|-----------|------------|
| `pcb` | `export` (gerbers, drill, step, ipc2581, odb, svg, dxf, pdf, 3dpdf, etc.), `render`, `drc`, `import`, `upgrade` |
| `sch` | `erc`, `export` (netlist, pdf, bom, svg), `upgrade` |
| `fp` | `export` (svg), `upgrade` |
| `sym` | `export`, `upgrade` |
| `jobset` | Jobset operations |
| `version` | Reports version |

## Common test commands

```bash
export KICAD_CLI="/mnt/e/KiCad/10.0/bin/kicad-cli.exe"
"$KICAD" version
"$KICAD" pcb render --output "E:\\tmp\\render.png" "E:\\tmp\\board.kicad_pcb"
"$KICAD" pcb drc --output "E:\\tmp\\drc.rpt" "E:\\tmp\\board.kicad_pcb"
"$KICAD" pcb export gerbers --output "E:\\tmp\\gerbers\\" "E:\\tmp\\board.kicad_pcb"
"$KICAD" sch erc --output "E:\\tmp\\erc.rpt" "E:\\tmp\\schematic.kicad_sch"
```

## Minimal test board

```sexpr
(kicad_pcb (version 20240123)
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal))
  (net 0 "")
)
```

## Minimal test schematic

```sexpr
(kicad_sch (version 20240123)
  (symbol "R" (in_bom yes) (on_board yes)
    (property "Reference" "R1")
    (property "Value" "10k"))
)
```

## Dependencies

- KiCad 10.0+ (provides kicad-cli.exe)
- WSL with /mnt/e/ mounted (WSL auto-mounts Windows drives)
- Python 3.10+ for the MCP server
