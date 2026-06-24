# Template Variables Per Stack

Auto-injected for all stacks: `harnessVersion` (from package.json), `maxRetries` (3).

| Stack | testCmd | lintCmd | typeCheckCmd | buildCmd | installCmd | configFile | versionFile |
|-------|---------|---------|-------------|----------|------------|------------|-------------|
| python | python3 -m pytest | python3 -m ruff check | python3 -m mypy | python3 -m build | python3 -m pip install -e . | pyproject.toml | .python-version |
| node | npm test | npx eslint . | npx tsc --noEmit | npm run build | npm install | package.json | .nvmrc |
| go | go test ./... | go vet ./... | go build ./... | go build ./... | go mod download | go.mod | go.ver |
| rust | cargo test | cargo clippy -- -D warnings | cargo check | cargo build | cargo build | Cargo.toml | rust-toolchain.toml |
| c | ctest --output-on-failure | gcc -Wall -Wextra -pedantic -std=c17 -fsyntax-only $(find . -name '*.c') | _(empty)_ | mkdir -p build && cd build && cmake .. && make | _(empty)_ | CMakeLists.txt | _(empty)_ |
| cpp | ctest --output-on-failure | clang++ -Wall -Wextra -std=c++20 -fsyntax-only $(find . -name '*.cpp' -o -name '*.hpp') | _(empty)_ | mkdir -p build && cd build && cmake .. && make | _(empty)_ | CMakeLists.txt | _(empty)_ |
| vhdl | ghdl -a --std=08 $(find . -name '*.vhdl' -o -name '*.vhd') && ghdl -e entity_name && ghdl -r entity_name --assert-level=error | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ |
| verilog | iverilog -o testbench $(find . -name '*.v' -o -name '*.sv') && vvp testbench | verilator --lint-only $(find . -name '*.v' -o -name '*.sv') | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ |
| generic | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ | _(empty)_ |
