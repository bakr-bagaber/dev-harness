# Stack Support Reference

## Detection Rules (priority order)

| Stack | Detect By | Verification |
|-------|-----------|-------------|
| Python | pyproject.toml, setup.py, requirements.txt, *.py | pytest, ruff, mypy, black --check |
| Node | package.json, tsconfig.json, *.js/*.ts | npm test/vitest, eslint, tsc --noEmit |
| Go | go.mod, *.go | go test, go vet, staticcheck |
| Rust | Cargo.toml, *.rs | cargo test, cargo clippy, cargo fmt --check |
| C | CMakeLists.txt + *.c, Makefile + *.c | ctest --output-on-failure, gcc -Wall -Wextra |
| C++ | CMakeLists.txt + *.cpp/*.hpp, Makefile + *.cc | ctest --output-on-failure, clang++ -Wall -Wextra |
| VHDL | *.vhdl, *.vhd | ghdl -a --std=08, ghdl -e, ghdl -r |
| Verilog | *.v, *.sv | iverilog -o tb, vvp tb, verilator --lint-only |
| Generic | Fallback — no match | ls, echo "verify manually" |

## Non-Software Stacks (future harness families)

| Family Future | Name | Description |
|--------------|------|-------------|
| Data Science | harness-data-science | Jupyter notebooks, ML experiments, data pipelines |
| DevOps | harness-devops | Infrastructure-as-code, CI/CD, kubernetes |
| Research | harness-research | Literature review, paper writing, experiment tracking |

## C/C++ Compiler Commands

Detect compiler at scaffold time and generate correct commands:

| Tool | Detection | Test Command |
|------|-----------|-------------|
| GCC | `gcc --version` | `gcc -Wall -Wextra -pedantic -o test_runner test_*.c && ./test_runner` |
| Clang | `clang --version` | `clang -Wall -Wextra -pedantic -o test_runner test_*.c && ./test_runner` |
| CMake | `cmake --version` | `cmake -S . -B build && cmake --build build && ctest --test-dir build` |

## HDL Simulator Commands

| Simulator | Detection | VHDL Command | Verilog Command |
|-----------|-----------|-------------|-----------------|
| GHDL | `ghdl --version` | `ghdl -a *.vhdl && ghdl -e <entity> && ghdl -r <entity>` | N/A |
| Icarus | `iverilog -V` | N/A | `iverilog -o tb *.v && vvp tb` |
| Verilator | `verilator --version` | N/A | `verilator --lint-only *.sv` |
| ModelSim | `vsim -version` | `vcom -2008 *.vhdl && vsim -c -do "run -all"` | `vlog *.sv && vsim -c -do "run -all"` |

Note: For VHDL, the top-level entity name is read from `spec/entity.txt` if it exists.
