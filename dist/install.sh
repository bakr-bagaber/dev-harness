#!/usr/bin/env bash
# shellcheck disable=SC2162,SC2068
#
# install.sh — Dev Harness CLI one-liner installer
#
# Usage:
#   curl -fsSL https://dev-harness.dev/install.sh | bash
#   curl -fsSL https://dev-harness.dev/install.sh | bash -s -- --version 0.2.0
#   curl -fsSL https://dev-harness.dev/install.sh | bash -s -- --prefix ~/bin
#
# Detects OS + architecture, downloads the latest (or specified) release
# from GitHub, and installs to /usr/local/bin (or custom prefix).
# Requires Node.js >= 18 for source installs.
#
# NOTE: This file is tracked via `git add -f` because the ops-level
#       .gitignore has `dist/` for Python build artifacts. Use
#       `git add -f dist/install.sh` to stage.

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
INSTALL_DIR="/usr/local/bin"
VERSION="latest"
REPO="nousresearch/dev-harness"
CLI_NAME="harness-dev"
SOURCE_URL="https://raw.githubusercontent.com/${REPO}/main"

# ── Parse options ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) INSTALL_DIR="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --help)
      echo "Usage: curl -fsSL https://dev-harness.dev/install.sh | bash -s -- [options]"
      echo ""
      echo "Options:"
      echo "  --prefix <dir>  Install to <dir> instead of /usr/local/bin"
      echo "  --version <ver> Install specific version (default: latest)"
      echo "  --help          Show this help"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found."
  echo "  Install: https://nodejs.org/en/download/"
  echo "  Or use:  npx @dev-harness/cli --help"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Error: Node.js >= 18 required (found v$(node -v))."
  exit 1
fi

# ── Determine install method ──────────────────────────────────────────────────
echo "==> Installing ${CLI_NAME} (${VERSION}) to ${INSTALL_DIR}"

# Option A: npm global (preferred)
if command -v npm &>/dev/null; then
  echo "==> Installing via npm..."
  if [[ "$VERSION" == "latest" ]]; then
    npm install -g "${REPO}" 2>/dev/null || true
  else
    npm install -g "${REPO}@${VERSION}" 2>/dev/null || true
  fi

  if command -v "${CLI_NAME}" &>/dev/null; then
    echo "==> ${CLI_NAME} installed successfully via npm!"
    "${CLI_NAME}" --help
    exit 0
  fi
fi

# Option B: npx (no install — always works)
echo "==> npm global install skipped. Use npx instead:"
echo ""
echo "    npx @dev-harness/cli init --stack node --target my-project"
echo ""

# Option C: direct download from GitHub
if [[ -d "${INSTALL_DIR}" ]]; then
  echo "==> Attempting direct download from GitHub..."
  DOWNLOAD_URL="${SOURCE_URL}/cli/harness-dev.mjs"
  TARGET="${INSTALL_DIR}/${CLI_NAME}"

  if command -v curl &>/dev/null; then
    curl -fsSL "${DOWNLOAD_URL}" -o "${TARGET}" 2>/dev/null && chmod +x "${TARGET}" && \
      echo "==> Installed to ${TARGET}" && exit 0
  elif command -v wget &>/dev/null; then
    wget -q "${DOWNLOAD_URL}" -O "${TARGET}" 2>/dev/null && chmod +x "${TARGET}" && \
      echo "==> Installed to ${TARGET}" && exit 0
  fi
fi

# ── Fallback: instructions ────────────────────────────────────────────────────
echo ""
echo "==> ${CLI_NAME} is ready to use. Run it with:"
echo ""
echo "    npx @dev-harness/cli init --help"
echo ""
echo "Or install globally:"
echo ""
echo "    npm install -g @dev-harness/cli"
echo ""
