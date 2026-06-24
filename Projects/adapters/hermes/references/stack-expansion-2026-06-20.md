# Stack Expansion — June 2026

## Summary

Expanded from 9 to 13 stacks during combined T17/T18 task. Added Java, Kotlin, .NET, MATLAB. Improved C, C++, VHDL, Verilog commands.

## New Stacks

| Stack | Detection | Config File | Version File | Init Files |
|-------|-----------|-------------|-------------|------------|
| Java | `pom.xml`, `build.gradle`, `.java` | `pom.xml` | `.java-version` (21) | 21 |
| Kotlin | `build.gradle.kts`, `.kt`, `.kts` | `build.gradle.kts` | `.java-version` (21) | 21 |
| .NET | `.cs`, `.fs`, `.vb` | (none) | `global.json` (8.0) | 20 |
| MATLAB | `.m` | (none) | (none) | 19 |

## Detection Priority Order

1. Python → 2. Java → 3. Kotlin → 4. Node → 5. Go → 6. Rust → 7. C → 8. C++ → 9. .NET → 10. MATLAB → 11. VHDL → 12. Verilog → 13. Generic

## Config File Stubs

- **Java Maven POM** — groups/com/mycompany, Java 21 source/target
- **Kotlin Gradle** — Kotlin JVM 2.0, mainClass = "MainKt", stdlib dependency

## .gitignore Patterns

- **Java** — *.class, *.jar, target/, build/, .gradle/
- **Kotlin** — *.class, *.jar, build/, .gradle/
- **.NET** — bin/, obj/, *.user, *.suo, *.nupkg
- **MATLAB** — *.asv, *.m~, *.mat, slprj/, simulink/

## Improved Existing Stacks

| Stack | What Changed |
|-------|-------------|
| C | installCmd (apt-get build-essential cmake / brew install cmake) |
| C++ | Same as C |
| VHDL | lintCmd (ghdl -s), installCmd (ghdl) |
| Verilog | installCmd (iverilog, verilator) |

## Files Changed

- `cli/lib/schemas/stacks.json` — 4 new entries, 4 improved entries
- `cli/lib/detect-stack.mjs` — 4 new detection rule blocks (Java, Kotlin, .NET, MATLAB)
- `cli/commands/init.mjs` — GITIGNORE_PATTERNS (4 new), STACK_CONFIG_STUBS (2 new), STACK_VERSION_STUBS (4 new)
