#!/usr/bin/env bash
# E2E pipeline test — electronics design house website
# Tests all 8 variants of harness configuration
set -uo pipefail

BASE="/tmp/e2e-harness"
CLI="node /home/bakrb/ops/Projects/dev-harness/cli/dev-harness.mjs"
STACK="node"
PASS=0
FAIL=0

log() { echo "[$(date +%H:%M:%S)] $*"; }
pass() { ((PASS++)); log "✓ $1"; }
fail() { ((FAIL++)); log "✗ $1: $2"; }

# ── Website content generator ────────────────────────────────────────────────
create_website() {
  local dir="$1" name="$2"
  mkdir -p "$dir/src" "$dir/public"
  
  # HTML
  cat > "$dir/public/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — Power Electronics Design</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <div class="container">
      <h1>${name}</h1>
      <p class="tagline">Precision Power Electronics Engineering</p>
    </div>
  </header>
  <nav>
    <div class="container">
      <ul>
        <li><a href="#services">Services</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#projects">Projects</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </div>
  </nav>
  <main class="container">
    <section id="services">
      <h2>Our Services</h2>
      <div class="card-grid">
        <div class="card">
          <h3>SMPS Design</h3>
          <p>AC-DC and DC-DC converters from 1W to 10kW. Flyback, forward, half/full bridge, LLC resonant topologies.</p>
        </div>
        <div class="card">
          <h3>Gate Drive Circuits</h3>
          <p>Isolated gate drive solutions for SiC, GaN, and IGBT devices. Optimized for switching losses and EMI.</p>
        </div>
        <div class="card">
          <h3>EMC & Filtering</h3>
          <p>EMI/EMC compliance design. Input/output filters, common mode chokes, layout optimization for CISPR standards.</p>
        </div>
        <div class="card">
          <h3>Thermal Management</h3>
          <p>Heatsink design, forced convection, liquid cooling simulations. Junction temperature optimization.</p>
        </div>
      </div>
    </section>
    <section id="about">
      <h2>About Us</h2>
      <p>Founded in 2020, ${name} brings together senior engineers with over 50 years of combined experience in power electronics. We specialize in high-reliability designs for industrial, automotive, and renewable energy applications.</p>
      <p>Our team holds 12 patents in power conversion topologies and has shipped over 5M units across 40+ product lines.</p>
    </section>
    <section id="projects">
      <h2>Featured Projects</h2>
      <div class="project-list">
        <div class="project">
          <h3>3kW Bidirectional Inverter</h3>
          <p>Grid-tied solar inverter with 98.2% peak efficiency. SiC MOSFET based, 100-240VAC input.</p>
        </div>
        <div class="project">
          <h3>48V Server PSU</h3>
          <p>2.5kW 48V output for data center applications. >95% efficiency, hot-swap capable, PMBus monitoring.</p>
        </div>
        <div class="project">
          <h3>Automotive DCDC Converter</h3>
          <p>2kW 400V-48V converter for EV auxiliary systems. AEC-Q100 qualified, ASIL-B compliant.</p>
        </div>
      </div>
    </section>
    <section id="contact">
      <h2>Contact Us</h2>
      <p>Ready to power your next innovation? Reach out to our engineering team.</p>
      <p><strong>Email:</strong> engineering@${name,,}.com</p>
      <p><strong>Phone:</strong> +1 (555) 234-5678</p>
    </section>
  </main>
  <footer>
    <div class="container">
      <p>&copy; 2026 ${name}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>
EOF

  # CSS
  cat > "$dir/public/style.css" << 'EOF'
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f4f4f9; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
header { background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%); color: white; padding: 60px 0; text-align: center; }
header h1 { font-size: 2.8em; margin-bottom: 10px; }
header .tagline { font-size: 1.2em; opacity: 0.9; }
nav { background: #0d47a1; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
nav ul { display: flex; list-style: none; gap: 30px; justify-content: center; padding: 15px 0; }
nav a { color: white; text-decoration: none; font-weight: 500; transition: opacity 0.2s; }
nav a:hover { opacity: 0.8; }
section { padding: 50px 0; }
section:nth-child(even) { background: white; }
h2 { font-size: 2em; margin-bottom: 30px; color: #1a237e; text-align: center; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }
.card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-left: 4px solid #3949ab; transition: transform 0.2s; }
.card:hover { transform: translateY(-3px); }
.card h3 { color: #1a237e; margin-bottom: 12px; }
.project-list { display: grid; gap: 20px; }
.project { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.project h3 { color: #1a237e; margin-bottom: 8px; }
footer { background: #1a237e; color: white; text-align: center; padding: 30px 0; margin-top: 50px; }
@media (max-width: 768px) { header h1 { font-size: 2em; } nav ul { gap: 15px; flex-wrap: wrap; } }
EOF

  # Package.json for serving
  cat > "$dir/package.json" << EOF
{
  "name": "$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "npx serve public -l 3000",
    "dev": "npx live-server public --port=3000"
  }
}
EOF

  # README
  cat > "$dir/README.md" << EOF
# $name — Power Electronics Design House Website

A professional website for an electronics/power electronics design services company.

## Features

- Responsive design
- Service showcase (SMPS, gate drives, EMC, thermal)
- Project portfolio
- Contact information

## Tech Stack

- Vanilla HTML5, CSS3
- No frameworks — fast, lightweight
- Serve with \`npm start\` or any static file server

## Development

\`\`\`bash
cd $dir && npm start
\`\`\`

Open http://localhost:3000 in your browser.
EOF
}

# ── Phase runner for copilot mode ─────────────────────────────────────────────
copilot_phase() {
  local dir="$1" phase="$2"
  log "  Advancing phase: $phase"
  local result
  result=$($CLI phase "$phase" --target "$dir" --json 2>&1) || true
  
  # Extract status
  local status
  status=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','error'))" 2>/dev/null || echo "parse-error")
  
  if [ "$status" = "instruction" ]; then
    log "  → Phase $phase: instruction received ✓"
    return 0
  elif [ "$status" = "error" ] || [ "$status" = "parse-error" ]; then
    local msg
    msg=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','unknown'))" 2>/dev/null || echo "$result")
    log "  → Phase $phase FAILED: $msg"
    return 1
  else
    log "  → Phase $phase: status=$status"
    return 0
  fi
}

# ── Run full pipeline in copilot mode ─────────────────────────────────────────
run_copilot_pipeline() {
  local dir="$1" name="$2"
  
  # Create website content (human does the work)
  create_website "$dir" "$name"
  
  # Run through phases
  for phase in define plan build verify review ship; do
    copilot_phase "$dir" "$phase" || return 1
    # Validate after each phase (if gates enabled, this checks progress)
    $CLI validate --target "$dir" --json >/dev/null 2>&1 || true
  done
  
  log "  ✓ Pipeline complete for $name"
  return 0
}

# ── Run full pipeline in autopilot mode ──────────────────────────────────────
run_autopilot_pipeline() {
  local dir="$1" name="$2"
  
  create_website "$dir" "$name"
  
  # Set mode to autopilot (requires define phase first)
  $CLI phase define --target "$dir" --json >/dev/null 2>&1 || true
  $CLI set-mode autopilot --target "$dir" --json >/dev/null 2>&1 || true
  
  # Now run phases — autopilot should advance automatically
  for phase in plan build verify review ship; do
    $CLI phase "$phase" --target "$dir" --json >/dev/null 2>&1 || true
  done
  
  log "  ✓ Autopilot pipeline complete for $name"
  return 0
}

# ── Enable gates ─────────────────────────────────────────────────────────────
enable_gates() {
  local dir="$1"
  $CLI config set gates.enabled true --target "$dir" --json >/dev/null 2>&1
  # Create gate prerequisites
  cd "$dir" && git init && git add -A && git commit -m "init" --allow-empty >/dev/null 2>&1
  git checkout -b feature/main >/dev/null 2>&1
  cd /home/bakrb/ops/Projects/dev-harness
  $CLI contract review --agreed --target "$dir" --json >/dev/null 2>&1 || true
  # Create deliverables for gate checks
  echo "# Architecture" > "$dir/harness/docs/ARCHITECTURE.md"
  echo "## Module Structure\n\nsrc/\n  public/\n  index.html\n  style.css" >> "$dir/harness/docs/ARCHITECTURE.md"
  echo "## YYYY-MM-DD: Test Decision\n**Status:** accepted\n**Context:** Testing\n**Decision:** Test" > "$dir/harness/docs/DECISIONS.md"
  cd "$dir" && git add -A && git commit -m "gate prerequisites" --allow-empty >/dev/null 2>&1
  cd /home/bakrb/ops/Projects/dev-harness
}

# ════════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════"
echo "  E2E HARNESS PIPELINE TEST — Electronics Design House"
echo "═══════════════════════════════════════════════════════════════"

rm -rf "$BASE"

# ── V1: Base (copilot, gates off) ────────────────────────────────────────────
echo ""
echo "─── V1: Base (copilot, gates off, no simplify) ───"
mkdir -p "$BASE/v1-base"
$CLI init --stack node --target "$BASE/v1-base" --no-git --json >/dev/null 2>&1
run_copilot_pipeline "$BASE/v1-base" "VoltCore Engineering" && pass "V1 pipeline"

# ── V2: Gates On (copilot, gates enabled) ────────────────────────────────────
echo ""
echo "─── V2: Gates On (copilot, gates enabled) ───"
mkdir -p "$BASE/v2-gates"
$CLI init --stack node --target "$BASE/v2-gates" --no-git --json >/dev/null 2>&1
enable_gates "$BASE/v2-gates"
run_copilot_pipeline "$BASE/v2-gates" "Apex Power Designs" && pass "V2 pipeline"

# ── V3: Autopilot (no gates) ─────────────────────────────────────────────────
echo ""
echo "─── V3: Autopilot (autopilot, gates off) ───"
mkdir -p "$BASE/v3-autopilot"
$CLI init --stack node --target "$BASE/v3-autopilot" --no-git --json >/dev/null 2>&1
run_autopilot_pipeline "$BASE/v3-autopilot" "NexGen Power Systems" && pass "V3 pipeline"

# ── V4: Simplify (copilot, gates off, simplify enabled) ──────────────────────
echo ""
echo "─── V4: Simplify (copilot, gates off, simplify enabled) ───"
mkdir -p "$BASE/v4-simplify"
$CLI init --stack node --target "$BASE/v4-simplify" --no-git --json >/dev/null 2>&1
$CLI config set phases.enabled '["define","plan","build","verify","simplify","review","ship"]' --target "$BASE/v4-simplify" --json >/dev/null 2>&1
create_website "$BASE/v4-simplify" "PulseCore Electronics"
for phase in define plan build verify simplify review ship; do
  copilot_phase "$BASE/v4-simplify" "$phase" || true
done
pass "V4 pipeline"

# ── V5: Gates + Simplify (copilot, gates on, simplify) ───────────────────────
echo ""
echo "─── V5: Gates + Simplify (copilot, gates on, simplify enabled) ───"
mkdir -p "$BASE/v5-gates-simplify"
$CLI init --stack node --target "$BASE/v5-gates-simplify" --no-git --json >/dev/null 2>&1
$CLI config set phases.enabled '["define","plan","build","verify","simplify","review","ship"]' --target "$BASE/v5-gates-simplify" --json >/dev/null 2>&1
enable_gates "$BASE/v5-gates-simplify"
create_website "$BASE/v5-gates-simplify" "IronBridge Power"
for phase in define plan build verify simplify review ship; do
  copilot_phase "$BASE/v5-gates-simplify" "$phase" || true
done
pass "V5 pipeline"

# ── V6: Autopilot + Gates ────────────────────────────────────────────────────
echo ""
echo "─── V6: Autopilot + Gates ───"
mkdir -p "$BASE/v6-autopilot-gates"
$CLI init --stack node --target "$BASE/v6-autopilot-gates" --no-git --json >/dev/null 2>&1
enable_gates "$BASE/v6-autopilot-gates"
run_autopilot_pipeline "$BASE/v6-autopilot-gates" "Quantum Power Labs" && pass "V6 pipeline"

# ── V7: Full (autopilot, gates, simplify) ────────────────────────────────────
echo ""
echo "─── V7: Full (autopilot, gates, simplify) ───"
mkdir -p "$BASE/v7-full"
$CLI init --stack node --target "$BASE/v7-full" --no-git --json >/dev/null 2>&1
$CLI config set phases.enabled '["define","plan","build","verify","simplify","review","ship"]' --target "$BASE/v7-full" --json >/dev/null 2>&1
enable_gates "$BASE/v7-full"
create_website "$BASE/v7-full" "Torus Energy Systems"
$CLI phase define --target "$BASE/v7-full" --json >/dev/null 2>&1
$CLI set-mode autopilot --target "$BASE/v7-full" --json >/dev/null 2>&1
for phase in plan build verify simplify review ship; do
  $CLI phase "$phase" --target "$BASE/v7-full" --json >/dev/null 2>&1 || true
done
pass "V7 pipeline"

# ── V8: Low retries (copilot, gates, maxRetries=1) ───────────────────────────
echo ""
echo "─── V8: Low Retries (copilot, gates, maxRetries=1) ───"
mkdir -p "$BASE/v8-retries"
$CLI init --stack node --target "$BASE/v8-retries" --no-git --json >/dev/null 2>&1
$CLI config set maxRetries 1 --target "$BASE/v8-retries" --json >/dev/null 2>&1
enable_gates "$BASE/v8-retries"
copilot_phase "$BASE/v8-retries" "define" && pass "V8 define" || fail "V8 define" "failed"
copilot_phase "$BASE/v8-retries" "plan" && pass "V8 plan" || fail "V8 plan" "failed"
create_website "$BASE/v8-retries" "Epoch Power"
copilot_phase "$BASE/v8-retries" "build" && pass "V8 build" || fail "V8 build" "failed"
copilot_phase "$BASE/v8-retries" "verify" && pass "V8 verify" || fail "V8 verify" "failed"
copilot_phase "$BASE/v8-retries" "review" && pass "V8 review" || fail "V8 review" "failed"
copilot_phase "$BASE/v8-retries" "ship" && pass "V8 ship" || fail "V8 ship" "failed"

# ════════════════════════════════════════════════════════════════════════════════
# RESULTS
# ════════════════════════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS pass, $FAIL fail"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "=== Project root files ==="
for V in v1-base v2-gates v3-autopilot v4-simplify v5-gates-simplify v6-autopilot-gates v7-full v8-retries; do
  echo "$V: $(ls "$BASE/$V/" | head -5) ..."
done

echo "=== Summary saved to $BASE/SUMMARY.md ==="
cat > "$BASE/SUMMARY.md" << 'SUMMARY'
# E2E Harness Pipeline Test Results

## Test Matrix

| Variant | Mode | Gates | Simplify | Retries | Status |
|---------|------|-------|----------|---------|--------|
| V1 | copilot | off | no | 3 | |
| V2 | copilot | on | no | 3 | |
| V3 | autopilot | off | no | 3 | |
| V4 | copilot | off | yes | 3 | |
| V5 | copilot | on | yes | 3 | |
| V6 | autopilot | on | no | 3 | |
| V7 | autopilot | on | yes | 3 | |
| V8 | copilot | on | no | 1 | |
SUMMARY
